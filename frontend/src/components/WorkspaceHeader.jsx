function WorkspaceHeader({ activeTab, statusChips }) {
  return (
    <section className="section-head">
      <h2>Workspace</h2>
      <p className="section-copy">
        {activeTab === "session" &&
          "Connect wallet, choose account, and set contract/network options."}
        {activeTab === "seller" &&
          "Create listings, publish inventory, and withdraw earnings."}
        {activeTab === "buyer" &&
          "Buy individual items or complete a batch checkout."}
        {activeTab === "explorer" &&
          "Inspect listings, balances, limits, and seller activity."}
      </p>
      <div className="status-chip-row">
        {statusChips.map((chip) => (
          <span key={chip.key} className={`status-chip ${chip.tone}`}>
            {chip.label}
          </span>
        ))}
      </div>
    </section>
  );
}

export default WorkspaceHeader;
