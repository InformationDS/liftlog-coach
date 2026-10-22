export function Toast({text}: {text: string}) {return text ? <div role="status" className="fixed bottom-24 left-1/2 z-30 max-w-sm -translate-x-1/2 rounded bg-navy px-4 py-2 text-white">{text}</div> : null;}

