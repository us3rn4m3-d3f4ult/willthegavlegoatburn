export function HowTradingWorks() {
  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <h2 className="text-[13px] font-semibold tracking-tight">How trading works</h2>
      <div className="mt-2 space-y-2 text-[11.5px] leading-relaxed text-muted">
        <p>
          <span className="font-medium text-fg">Market order</span> — give a USDC amount and the
          panel walks the book, cheapest offer first, filling every level it needs. The worst
          price is shown before you sign.
        </p>
        <p>
          <span className="font-medium text-fg">Limit order</span> — pick a price, post a bid or
          ask, and it rests until someone takes it. Click any price in the book to load it here.
        </p>
        <p>
          USDC sits in the contract, not with us. Selling needs shares, and shares come from
          splitting USDC 1:1 into one Yes and one No — done for you when needed. Withdraw at any
          time.
        </p>
      </div>
    </section>
  );
}
