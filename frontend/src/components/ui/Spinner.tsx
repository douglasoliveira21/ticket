const sizeClasses = {
  sm: 'h-5 w-5 border-b-2',
  md: 'h-8 w-8 border-b-2',
  lg: 'h-12 w-12 border-b-4',
};

export default function Spinner({ size = 'md', wrapperClassName = 'py-8' }: { size?: keyof typeof sizeClasses; wrapperClassName?: string }) {
  return (
    <div className={`flex justify-center ${wrapperClassName}`}>
      <div className={`animate-spin rounded-full border-primary-700 ${sizeClasses[size]}`}></div>
    </div>
  );
}
