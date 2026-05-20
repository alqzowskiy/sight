import type { Account } from "@/types";
import { getAccountTrajectory } from "@/lib/utils/forecast";
import { pickChannelAndFee } from "./channels";
import { convertAmount } from "./fx";
import type {
  AccountPressure,
  OptimizerPlan,
  OptimizerStep,
} from "./types";

const HORIZON_DAYS = 14;
const BUFFER_PCT = 1.15;
const MAX_ITERATIONS = 40;
const MIN_TRANSFER_AMOUNT = 5_000;
const DONOR_RETENTION_PCT = 0.92;

function urgencyWeight(dayOffset: number): number {
  return Math.max(1, HORIZON_DAYS + 1 - dayOffset);
}

interface DailyTrajectory {
  base: number[];
  todayForecast: number;
}

function cacheTrajectory(account: Account): DailyTrajectory {
  const points = getAccountTrajectory(account.id, 0, HORIZON_DAYS);
  const base = new Array(HORIZON_DAYS + 1).fill(account.balance);
  let todayForecast = account.balance;
  for (const p of points) {
    if (p.dayOffset < 0 || p.dayOffset > HORIZON_DAYS) continue;
    base[p.dayOffset] = p.balance;
    if (p.dayOffset === 0) todayForecast = p.balance;
  }
  return { base, todayForecast };
}

function effectiveBalance(
  account: Account,
  traj: DailyTrajectory,
  dayOffset: number,
  shift: number,
): number {
  const boost = account.balance - traj.todayForecast;
  return traj.base[dayOffset] + boost + shift;
}

function pressureFor(
  account: Account,
  traj: DailyTrajectory,
  shifts: number[],
): AccountPressure {
  let pressure = 0;
  let worstDayOffset = 0;
  let worstDeficit = 0;
  let minSurplus = Number.POSITIVE_INFINITY;

  for (let d = 0; d <= HORIZON_DAYS; d++) {
    const bal = effectiveBalance(account, traj, d, shifts[d]);
    const deficit = account.minBalance - bal;
    if (deficit > 0) {
      pressure += deficit * urgencyWeight(d);
      if (deficit > worstDeficit) {
        worstDeficit = deficit;
        worstDayOffset = d;
      }
    }
    const surplus = bal - account.minBalance;
    if (surplus < minSurplus) minSurplus = surplus;
  }

  return {
    accountId: account.id,
    currency: account.currency,
    pressure,
    worstDayOffset,
    worstDeficit,
    supply: Math.max(0, minSurplus),
  };
}

function countDeficitDays(
  accounts: Account[],
  trajCache: Map<string, DailyTrajectory>,
  shiftCache: Map<string, number[]>,
): number {
  let count = 0;
  for (const acc of accounts) {
    const traj = trajCache.get(acc.id);
    const shifts = shiftCache.get(acc.id);
    if (!traj || !shifts) continue;
    for (let d = 0; d <= HORIZON_DAYS; d++) {
      const bal = effectiveBalance(acc, traj, d, shifts[d]);
      if (bal < acc.minBalance) count++;
    }
  }
  return count;
}

function totalPressure(pressures: AccountPressure[]): number {
  let sum = 0;
  for (const p of pressures) sum += p.pressure;
  return sum;
}

export function computeLiquidityGradientPlan(
  accounts: Account[],
): OptimizerPlan {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const trajCache = new Map<string, DailyTrajectory>();
  const shiftCache = new Map<string, number[]>();

  for (const a of accounts) {
    trajCache.set(a.id, cacheTrajectory(a));
    shiftCache.set(a.id, new Array(HORIZON_DAYS + 1).fill(0));
  }

  const pressuresBefore = accounts.map((a) =>
    pressureFor(a, trajCache.get(a.id)!, shiftCache.get(a.id)!),
  );
  const beforeDeficitDays = countDeficitDays(accounts, trajCache, shiftCache);
  const beforePressureTotal = totalPressure(pressuresBefore);

  const steps: OptimizerStep[] = [];
  let totalFees = 0;
  let iter = 0;

  for (; iter < MAX_ITERATIONS; iter++) {
    const pressures = accounts.map((a) =>
      pressureFor(a, trajCache.get(a.id)!, shiftCache.get(a.id)!),
    );

    const ranked = [...pressures].sort((a, b) => b.pressure - a.pressure);
    const receiver = ranked[0];
    if (receiver.pressure < 1) break;

    const receiverAcc = accountById.get(receiver.accountId)!;
    const receiverTraj = trajCache.get(receiver.accountId)!;
    const receiverShifts = shiftCache.get(receiver.accountId)!;

    const candidates = ranked
      .filter((p) => p.accountId !== receiver.accountId)
      .filter((p) => p.supply > MIN_TRANSFER_AMOUNT)
      // Same-currency donors come first (no FX cost). Within each group: more supply wins.
      .sort((a, b) => {
        const aSame = a.currency === receiver.currency ? 1 : 0;
        const bSame = b.currency === receiver.currency ? 1 : 0;
        if (aSame !== bSame) return bSame - aSame;
        return b.supply - a.supply;
      });

    if (candidates.length === 0) break;
    const donor = candidates[0];
    const donorAcc = accountById.get(donor.accountId)!;

    // Compute amount in receiver's currency first (how much receiver actually needs).
    const targetAtWorst = receiverAcc.minBalance * BUFFER_PCT;
    const worstBalNow = effectiveBalance(
      receiverAcc,
      receiverTraj,
      receiver.worstDayOffset,
      receiverShifts[receiver.worstDayOffset],
    );
    const neededReceiverCcy = Math.max(0, targetAtWorst - worstBalNow);

    // Convert receiver's need into donor's currency to know how much to send.
    const neededInDonorCcy = convertAmount(
      neededReceiverCcy,
      receiverAcc.currency,
      donorAcc.currency,
    );

    // Donor's supply is already in its own currency.
    const safeDonation = Math.floor(donor.supply * DONOR_RETENTION_PCT);
    const sendAmount = Math.floor(
      Math.min(neededInDonorCcy, safeDonation),
    );

    if (sendAmount < MIN_TRANSFER_AMOUNT) break;

    const channelInfo = pickChannelAndFee(
      sendAmount,
      { currency: donorAcc.currency, type: donorAcc.type },
      { currency: receiverAcc.currency, type: receiverAcc.type },
    );
    if (!channelInfo) break;

    const receivedAmount = Math.floor(
      convertAmount(sendAmount, donorAcc.currency, receiverAcc.currency),
    );

    const donorShifts = shiftCache.get(donor.accountId)!;
    for (let d = 0; d <= HORIZON_DAYS; d++) {
      donorShifts[d] -= sendAmount;
      receiverShifts[d] += receivedAmount;
    }

    const receiverCity =
      receiverAcc.name.split("·")[1]?.trim() ?? receiverAcc.id;
    const reasonSuffix = channelInfo.fxApplied
      ? ` (FX ${donorAcc.currency}→${receiverAcc.currency})`
      : "";

    steps.push({
      from: donor.accountId,
      to: receiver.accountId,
      amount: sendAmount,
      channel: channelInfo.channel,
      currency: donorAcc.currency,
      fee: channelInfo.fee,
      fromLocation: donorAcc.location,
      toLocation: receiverAcc.location,
      reason: `Lifts ${receiverCity} above min on day +${receiver.worstDayOffset}${reasonSuffix}`,
      fxApplied: channelInfo.fxApplied,
      receivedAmount,
      receivedCurrency: receiverAcc.currency,
    });
    totalFees += channelInfo.fee;
  }

  const pressuresAfter = accounts.map((a) =>
    pressureFor(a, trajCache.get(a.id)!, shiftCache.get(a.id)!),
  );
  const afterDeficitDays = countDeficitDays(accounts, trajCache, shiftCache);

  return {
    steps,
    totalFees,
    beforeDeficitDays,
    afterDeficitDays,
    beforePressureTotal,
    afterPressureTotal: totalPressure(pressuresAfter),
    pressuresBefore,
    pressuresAfter,
    iterations: iter,
  };
}
