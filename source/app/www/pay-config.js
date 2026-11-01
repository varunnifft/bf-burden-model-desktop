/* Paid pages and ads (BF Model 3.1). The Report and Other charging modes pages are paid: price below for each period.
   A page is only locked where a way to pay exists: Google Play billing in the phone app, or Razorpay on Windows / Mac
   once the Razorpay keys are in the server's script properties. Until then every page stays open. */
window.BF_PAY = {
  on: true,                 // false = no paid pages at all
  price: 25,                // ₹ per period
  currency: 'INR',
  months: 3,                // period: 3 months (Google Play: 3-month base plan; Windows/Mac: 90 days per payment)
  plan: 'all',              // 'all' = one purchase opens Report and Other charging modes together; 'each' = bought separately
  // Google Play subscription product IDs (Play Console > Monetize > Subscriptions); make them with exactly these IDs
  play: { all: 'bf_all_3m', report: 'bf_report_3m', modes: 'bf_modes_3m' }   // with plan 'all' only bf_all_3m is needed
};
/* Google AdMob banner on the Fact must know page (phone app only). These are Google's own test IDs: replace them with
   your AdMob app ID (in AndroidManifest.xml) and banner unit ID (here) before publishing. */
window.BF_ADS = {
  on: true,
  banner: 'ca-app-pub-3940256099942544/6300978111'      // test banner unit
};
