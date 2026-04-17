import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const markdownComponents: Components = {
  a: ({ href, children, ...rest }) => {
    const isExternal =
      typeof href === "string" &&
      (href.startsWith("http://") || href.startsWith("https://"));
    return (
      <a
        href={href}
        {...rest}
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  },
};

export function PostMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {children}
    </ReactMarkdown>
  );
}
