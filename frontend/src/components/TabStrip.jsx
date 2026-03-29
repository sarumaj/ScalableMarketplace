function TabStrip({ activeTab, isBusy, setActiveTab }) {
  return (
    <section className="tab-strip panel">
      <button
        className={`tab-button ${activeTab === "session" ? "active" : ""}`}
        onClick={() => setActiveTab("session")}
        disabled={isBusy}
      >
        Session
      </button>
      <button
        className={`tab-button ${activeTab === "seller" ? "active" : ""}`}
        onClick={() => setActiveTab("seller")}
        disabled={isBusy}
      >
        Seller
      </button>
      <button
        className={`tab-button ${activeTab === "buyer" ? "active" : ""}`}
        onClick={() => setActiveTab("buyer")}
        disabled={isBusy}
      >
        Buyer
      </button>
      <button
        className={`tab-button ${activeTab === "explorer" ? "active" : ""}`}
        onClick={() => setActiveTab("explorer")}
        disabled={isBusy}
      >
        Explorer
      </button>
    </section>
  );
}

export default TabStrip;
