import Image from "next/image";

interface BookLoaderProps {
  size?: number;
  message?: string;
  className?: string;
}

export default function BookLoader({ size = 64, message = "Carregando...", className = "" }: BookLoaderProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <Image 
        src="/BookLoader.gif" 
        alt="Carregando" 
        width={size} 
        height={size}
        className="opacity-90"
      />
      {message && <p className="text-sm font-medium text-slate-500 animate-pulse">{message}</p>}
    </div>
  );
}
