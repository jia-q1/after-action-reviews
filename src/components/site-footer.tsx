import UnEmblem from "@/components/un-emblem";

export default function SiteFooter() {
  return (
    <footer className="bg-un-blue-950 text-un-blue-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 grid gap-8 sm:grid-cols-3">
        <div className="flex items-start gap-3">
          <UnEmblem className="h-9 w-9 shrink-0" />
          <div>
            <p className="font-serif text-base font-semibold text-white">
              After Action Review Library
            </p>
            <p className="mt-1 text-sm text-un-blue-400">
              A shared record of lessons learned across field operations,
              missions, and programmes.
            </p>
          </div>
        </div>

        <div className="text-sm">
          <p className="font-semibold text-white mb-2">Navigate</p>
          <ul className="space-y-1.5 text-un-blue-400">
            <li>Review Library</li>
            <li>Draft a New Review</li>
            <li>Review Guidelines</li>
          </ul>
        </div>

        <div className="text-sm">
          <p className="font-semibold text-white mb-2">About this tool</p>
          <p className="text-un-blue-400 leading-relaxed">
            AI-assisted drafts are always reviewed and approved by a human
            editor before publication to the library.
          </p>
        </div>
      </div>
    </footer>
  );
}
