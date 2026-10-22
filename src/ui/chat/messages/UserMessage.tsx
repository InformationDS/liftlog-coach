export function UserMessage({text}: {text: string}) {
  return <p className="ml-auto max-w-[80%] whitespace-pre-wrap break-words rounded bg-navy p-3 text-white">{text}</p>;
}
