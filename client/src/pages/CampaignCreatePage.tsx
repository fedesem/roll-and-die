import type { CampaignSourceBook } from "@shared/types";

interface CampaignCreatePageProps {
  campaignSourceBooks: CampaignSourceBook[];
  createCampaignName: string;
  createCampaignAllowedSourceBooks: string[];
  onCreateCampaignNameChange: (value: string) => void;
  onCreateCampaignAllowedSourceBooksChange: (value: string[]) => void;
  onCreateCampaign: () => void;
  onBack: () => void;
}

export function CampaignCreatePage({
  campaignSourceBooks,
  createCampaignName,
  createCampaignAllowedSourceBooks,
  onCreateCampaignNameChange,
  onCreateCampaignAllowedSourceBooksChange,
  onCreateCampaign,
  onBack
}: CampaignCreatePageProps) {
  const createBlocked = campaignSourceBooks.length > 0 && createCampaignAllowedSourceBooks.length === 0;

  return (
    <main className="grid gap-5 px-4 py-6 lg:px-8">
      <section className="rounded-none border border-amber-200/10 bg-slate-950/72 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-amber-200/55">Create</p>
            <h2 className="mt-2 font-serif text-2xl text-amber-50">New campaign room</h2>
          </div>
          <button className="inline-flex h-11 items-center justify-center rounded-none border border-white/12 bg-white/5 px-4 text-sm font-semibold text-slate-100 transition hover:border-amber-200/18 hover:bg-white/8" type="button" onClick={onBack}>
            Back to campaigns
          </button>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            className="h-12 flex-1 rounded-none border border-white/10 bg-white/[0.04] px-4 text-slate-100 outline-none transition focus:border-amber-200/30 focus:bg-white/[0.06]"
            placeholder="Campaign name"
            value={createCampaignName}
            onChange={(event) => onCreateCampaignNameChange(event.target.value)}
          />
          <button
            className="inline-flex h-12 items-center justify-center rounded-none border border-amber-200/20 bg-amber-300/18 px-5 text-sm font-semibold text-amber-50 transition hover:bg-amber-300/24 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onCreateCampaign}
            disabled={createBlocked}
          >
            Create
          </button>
        </div>
        {campaignSourceBooks.length > 0 ? (
          <div className="mt-5 border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-amber-200/55">Books</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">Choose which imported books will be available in this campaign.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100/80 transition hover:text-amber-50"
                  type="button"
                  onClick={() => onCreateCampaignAllowedSourceBooksChange(campaignSourceBooks.map((entry) => entry.source))}
                >
                  Select all
                </button>
                <button
                  className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300/80 transition hover:text-slate-100"
                  type="button"
                  onClick={() => onCreateCampaignAllowedSourceBooksChange([])}
                >
                  Deselect all
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {campaignSourceBooks.map((entry) => {
                const checked = createCampaignAllowedSourceBooks.includes(entry.source);

                return (
                  <label
                    key={entry.source}
                    title={`${entry.name}${entry.author ? ` • ${entry.author}` : ""}${entry.published ? ` • ${entry.published}` : ""}`}
                    className={`flex items-center justify-center gap-2 border px-2 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                      checked
                        ? "border-amber-300/40 bg-amber-300/16 text-amber-50"
                        : "border-white/10 bg-slate-950/50 text-slate-200 hover:border-white/20 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="sr-only">{entry.name}</span>
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        className="h-3.5 w-3.5"
                        onChange={() =>
                          onCreateCampaignAllowedSourceBooksChange(
                            checked
                              ? createCampaignAllowedSourceBooks.filter((source) => source !== entry.source)
                              : [...createCampaignAllowedSourceBooks, entry.source]
                          )
                        }
                      />
                      <span>{entry.source}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-5 text-sm leading-6 text-slate-400">No imported compendium books yet. New campaigns will start without a restricted book list.</p>
        )}
        {createBlocked ? <p className="mt-3 text-sm text-amber-100/80">Select at least one book to create a restricted campaign.</p> : null}
      </section>
    </main>
  );
}
