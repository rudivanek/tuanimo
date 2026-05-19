import { parseText } from './messageContentUtils';

interface MessageContentProps {
  text: string;
  className?: string;
  linkClassName?: string;
}

export function MessageContent({ text, className, linkClassName }: MessageContentProps) {
  const segments = parseText(text);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.kind === 'br') return <br key={i} />;
        if (seg.kind === 'link') {
          return (
            <a
              key={i}
              href={seg.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={linkClassName ?? 'underline underline-offset-2 break-all hover:opacity-75 transition-opacity'}
              onClick={(e) => e.stopPropagation()}
            >
              {seg.url}
            </a>
          );
        }
        if (seg.kind === 'suspicious') {
          return (
            <span key={i} className="break-all">
              {seg.url}
              <span className="ml-1 text-xs opacity-40 font-normal select-none">(unverified link)</span>
            </span>
          );
        }
        return <span key={i}>{seg.text}</span>;
      })}
    </span>
  );
}
