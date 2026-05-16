type BrandMarkProps = {
  size?: number;
  className?: string;
};

export function BrandMark({ size = 20, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx="10"
        cy="10"
        r="8.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="13.25" cy="7.25" r="2.4" fill="currentColor" />
    </svg>
  );
}
