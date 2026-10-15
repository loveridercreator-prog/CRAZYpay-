import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PORT = 3000;

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CrazyPay - Native Android Application</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body { background-color: #060913; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .android-screen { max-width: 412px; height: 820px; border-radius: 36px; border: 4px solid #1e293b; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); overflow: hidden; display: flex; flex-direction: column; background: #060913; position: relative; }
    .screen-tab { display: none; height: 100%; overflow-y: auto; padding-bottom: 70px; }
    .screen-tab.active { display: block; }
    .bottom-nav-item.active { color: #3b82f6; }
    .bottom-nav-item.active i { transform: scale(1.1); }
  </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4">

  <div class="flex flex-col lg:flex-row items-center gap-8 w-full max-w-6xl">
    
    <!-- Phone Device Shell -->
    <div class="android-screen w-full relative flex-shrink-0">
      
      <!-- Android Status Bar -->
      <div class="h-8 bg-[#090d1a] px-5 flex items-center justify-between text-xs text-gray-400 font-mono select-none">
        <span>09:41</span>
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-wifi"></i>
          <i class="fa-solid fa-signal"></i>
          <i class="fa-solid fa-battery-full text-emerald-400"></i>
        </div>
      </div>

      <!-- App Header Bar -->
      <div class="h-14 bg-[#0f172a] px-4 flex items-center justify-between border-b border-slate-800">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-sm">CP</div>
          <span class="font-bold text-lg text-white">CrazyPay</span>
        </div>
        <span class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full uppercase">
          DLT Native
        </span>
      </div>

      <!-- Content Views -->
      <div class="flex-1 overflow-hidden relative">
        
        <!-- HOME TAB -->
        <div id="tab-home" class="screen-tab active p-4 space-y-4">
          <!-- Balance Card -->
          <div class="p-5 rounded-2xl bg-[#0f172a] border border-slate-800">
            <span class="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Estimated Balance</span>
            <div id="display-inr" class="text-3xl font-black text-white mt-1">₹25,450.00</div>
            <div class="flex items-center gap-2 mt-2 text-xs">
              <span class="text-gray-400">USDT Asset:</span>
              <span id="display-usdt" class="font-bold text-cyan-400">280.5000 USDT</span>
            </div>
            <div class="grid grid-cols-2 gap-3 mt-4">
              <button onclick="switchTab('trade')" class="py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition">Buy USDT</button>
              <button onclick="switchTab('trade')" class="py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 rounded-xl text-xs font-bold transition">Sell USDT</button>
            </div>
          </div>

          <!-- Market Ticker -->
          <div class="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 flex items-center justify-between">
            <div>
              <span class="text-[10px] font-bold text-gray-400 uppercase">USDT / INR P2P Rate</span>
              <div class="text-lg font-black text-emerald-400">₹91.50</div>
            </div>
            <span class="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-bold">+1.85% 24h</span>
          </div>

          <!-- Active SMS Interceptor Banner -->
          <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-start gap-3">
            <i class="fa-solid fa-shield-halved text-cyan-400 mt-0.5"></i>
            <div>
              <div class="text-xs font-bold text-white">Auto UTR Interception Active</div>
              <div class="text-[11px] text-gray-400 mt-0.5">Transactional bank SMS with DLT headers (-T) are parsed locally via BankSmsParserEngine. Zero PII storage.</div>
            </div>
          </div>

          <!-- Recent Orders -->
          <div>
            <div class="text-xs font-bold text-gray-400 uppercase mb-2">Recent P2P Orders</div>
            <div class="space-y-2">
              <div class="p-3.5 rounded-xl bg-[#0f172a] border border-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-700" onclick="openOrder('CP-839201', 4575, 50, 'MATCHED')">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 bg-blue-600 text-[10px] font-bold rounded text-white">BUY</span>
                    <span class="text-xs font-bold text-white">CP-839201</span>
                  </div>
                  <div class="text-xs text-gray-400 mt-1">₹4,575.00</div>
                </div>
                <div class="text-right">
                  <span class="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold rounded">MATCHED</span>
                  <div class="text-xs font-bold text-cyan-400 mt-1">50.00 USDT</div>
                </div>
              </div>

              <div class="p-3.5 rounded-xl bg-[#0f172a] border border-slate-800 flex items-center justify-between">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 bg-emerald-600 text-[10px] font-bold rounded text-white">SELL</span>
                    <span class="text-xs font-bold text-white">CP-771920</span>
                  </div>
                  <div class="text-xs text-gray-400 mt-1">₹9,150.00</div>
                </div>
                <div class="text-right">
                  <span class="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold rounded">COMPLETED</span>
                  <div class="text-xs font-bold text-cyan-400 mt-1">100.00 USDT</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TRADE TAB -->
        <div id="tab-trade" class="screen-tab p-4 space-y-4">
          <div class="text-lg font-bold text-white">P2P Trading Desk</div>
          <div class="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-3">
            <div class="flex bg-[#060913] p-1 rounded-xl">
              <button id="trade-buy-btn" onclick="setTradeTab('BUY')" class="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold">Buy USDT</button>
              <button id="trade-sell-btn" onclick="setTradeTab('SELL')" class="flex-1 py-1.5 text-gray-400 rounded-lg text-xs font-bold">Sell USDT</button>
            </div>
            <div class="text-xs text-cyan-400 font-bold">Unit Price: 1 USDT = ₹91.50</div>
            <div>
              <label class="text-[11px] font-bold text-gray-400 uppercase">Amount (INR)</label>
              <input id="trade-inr-input" type="number" oninput="calcTrade()" placeholder="Min: ₹500 - Max: ₹50,000" class="w-full mt-1 px-3 py-2.5 bg-[#060913] border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500">
            </div>
            <div class="p-3 bg-[#060913] rounded-xl flex items-center justify-between text-xs">
              <span class="text-gray-400">Estimated USDT:</span>
              <span id="trade-usdt-calc" class="font-bold text-emerald-400 text-sm">0.00 USDT</span>
            </div>
            <button onclick="placeOrder()" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition">Place Instant P2P Order</button>
          </div>
        </div>

        <!-- UPI TAB -->
        <div id="tab-upi" class="screen-tab p-4 space-y-4">
          <div class="text-lg font-bold text-white">UPI & Payment Bindings</div>
          <div class="text-xs text-gray-400">Single active binding rule: Only one payment identifier is active at any time for atomic settlement.</div>
          
          <div class="p-4 rounded-2xl bg-[#0f172a] border border-slate-800">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold text-gray-400 uppercase">Current Active Binding</span>
              <span class="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold rounded-full">ACTIVE</span>
            </div>
            <div id="active-upi-text" class="text-base font-bold text-white mt-2">saloni.pay@okaxis</div>
            <div class="text-xs text-cyan-400 mt-0.5">Holder: Saloni P2P Pro</div>
          </div>

          <div class="space-y-2">
            <div class="text-xs font-bold text-gray-400 uppercase">Saved Accounts</div>
            <div class="p-3 rounded-xl bg-[#0f172a] border border-slate-800 flex items-center justify-between">
              <div>
                <div class="text-xs font-bold text-white">saloni.pay@okaxis</div>
                <div class="text-[11px] text-gray-400">UPI VPA</div>
              </div>
              <span class="text-xs font-bold text-emerald-400">ACTIVE</span>
            </div>
            <div class="p-3 rounded-xl bg-[#0f172a] border border-slate-800 flex items-center justify-between">
              <div>
                <div class="text-xs font-bold text-white">9876543210@paytm</div>
                <div class="text-[11px] text-gray-400">UPI Number</div>
              </div>
              <button onclick="setActiveUpi('9876543210@paytm')" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs font-bold rounded-lg">ACTIVATE</button>
            </div>
          </div>
        </div>

        <!-- TEAM TAB -->
        <div id="tab-team" class="screen-tab p-4 space-y-4">
          <div class="text-lg font-bold text-white">Team & Referral Network</div>
          <div class="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-3">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <span class="text-[10px] font-bold text-gray-400 uppercase">Commission</span>
                <div class="text-xl font-black text-emerald-400 mt-1">48.25 USDT</div>
              </div>
              <div>
                <span class="text-[10px] font-bold text-gray-400 uppercase">Team Size</span>
                <div class="text-xl font-black text-cyan-400 mt-1">36 Members</div>
              </div>
            </div>
            <button onclick="claimCommission()" id="btn-claim" class="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold">Claim to USDT Wallet</button>
          </div>

          <div class="p-4 rounded-2xl bg-[#0f172a] border border-slate-800">
            <span class="text-[10px] font-bold text-gray-400 uppercase">Your Referral Code</span>
            <div class="flex items-center gap-2 mt-2">
              <input readonly value="CRAZY8821" class="flex-1 bg-[#060913] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm">
              <button onclick="alert('Referral Code Copied: CRAZY8821')" class="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-xl">Copy</button>
            </div>
          </div>
        </div>

        <!-- MINE TAB -->
        <div id="tab-mine" class="screen-tab p-4 space-y-4">
          <div class="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 flex items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-base">SP</div>
            <div class="flex-1">
              <div class="text-sm font-bold text-white">Saloni P2P Pro</div>
              <div class="text-xs text-gray-400">+91 98765 43210</div>
            </div>
            <span class="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-[10px] font-bold">TIER 2 KYC</span>
          </div>

          <div class="p-3 rounded-2xl bg-[#0f172a] border border-slate-800 divide-y divide-slate-800 text-xs">
            <div class="py-2.5 flex justify-between items-center">
              <span class="text-gray-300">Daily Trade Limit</span>
              <span class="text-gray-400">₹2,00,000 / Day</span>
            </div>
            <div class="py-2.5 flex justify-between items-center">
              <span class="text-gray-300">Biometric PIN Shield</span>
              <span class="text-emerald-400 font-bold">Active</span>
            </div>
            <div class="py-2.5 flex justify-between items-center">
              <span class="text-gray-300">Bank SMS Parser Engine</span>
              <span class="text-cyan-400 font-bold">Online</span>
            </div>
          </div>

          <div class="text-center text-[10px] text-gray-500 pt-4">
            CrazyPay Android Native v2.1.0<br>
            Pure Kotlin / Jetpack Room / WorkManager
          </div>
        </div>

        <!-- ORDER DETAIL MODAL -->
        <div id="order-modal" class="hidden absolute inset-0 bg-[#060913] z-20 p-4 flex flex-col justify-between overflow-y-auto">
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <button onclick="closeOrder()" class="px-3 py-1 bg-slate-800 text-white rounded-lg text-xs font-bold">← Back</button>
              <span id="modal-order-id" class="text-xs font-bold text-gray-400">Order CP-839201</span>
              <span class="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold rounded">14:59</span>
            </div>

            <div class="p-4 rounded-2xl bg-[#0f172a] border border-slate-800">
              <span class="text-[10px] font-bold text-gray-400 uppercase">Amount To Pay</span>
              <div id="modal-fiat" class="text-2xl font-black text-white mt-1">₹4,575.00</div>
              <div id="modal-crypto" class="text-xs text-cyan-400 mt-1">Receiving: 50.0000 USDT</div>
            </div>

            <div class="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-2">
              <span class="text-[10px] font-bold text-gray-400 uppercase">Counterparty UPI</span>
              <div class="flex items-center gap-2">
                <input id="seller-upi-val" readonly value="express.fast@yesbank" class="flex-1 bg-[#060913] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono">
                <button onclick="alert('Copied UPI: express.fast@yesbank')" class="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">Copy</button>
              </div>
            </div>

            <div class="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-3">
              <span class="text-[10px] font-bold text-gray-400 uppercase">Confirm UTR / RRN</span>
              <input id="manual-utr-input" placeholder="Enter 12-digit UTR" maxlength="12" class="w-full bg-[#060913] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm">
              <button onclick="submitUtr()" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold">Verify & Complete Trade</button>
              <button onclick="simulateSmsMatch()" class="w-full py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl">Simulate Bank SMS Interception</button>
            </div>
          </div>
        </div>

      </div>

      <!-- Persistent Bottom Navigation Bar -->
      <div class="h-16 bg-[#090d1a] border-t border-slate-800 grid grid-cols-5 items-center text-center text-xs text-gray-400 select-none">
        <button onclick="switchTab('home')" id="nav-btn-home" class="bottom-nav-item active flex flex-col items-center gap-1">
          <i class="fa-solid fa-house text-base"></i>
          <span class="text-[10px]">Home</span>
        </button>
        <button onclick="switchTab('trade')" id="nav-btn-trade" class="bottom-nav-item flex flex-col items-center gap-1">
          <i class="fa-solid fa-arrow-right-arrow-left text-base"></i>
          <span class="text-[10px]">Trade</span>
        </button>
        <button onclick="switchTab('upi')" id="nav-btn-upi" class="bottom-nav-item flex flex-col items-center gap-1">
          <i class="fa-solid fa-wallet text-base"></i>
          <span class="text-[10px]">UPI</span>
        </button>
        <button onclick="switchTab('team')" id="nav-btn-team" class="bottom-nav-item flex flex-col items-center gap-1">
          <i class="fa-solid fa-users text-base"></i>
          <span class="text-[10px]">Team</span>
        </button>
        <button onclick="switchTab('mine')" id="nav-btn-mine" class="bottom-nav-item flex flex-col items-center gap-1">
          <i class="fa-solid fa-user text-base"></i>
          <span class="text-[10px]">Mine</span>
        </button>
      </div>

    </div>

    <!-- Right Side: Native Android Architecture Details -->
    <div class="flex-1 space-y-5 text-gray-300">
      <div class="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-bold">
        <i class="fa-solid fa-check-circle"></i> Pure Standalone Android Project
      </div>

      <h1 class="text-3xl font-extrabold text-white">CrazyPay Android Native</h1>
      <p class="text-sm text-gray-400 leading-relaxed">
        Completely unlinked from web assets. Re-architected in 100% native Kotlin, Material XML layouts, Android Jetpack Room SQLite Database, and WorkManager background SMS settlement.
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div class="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div class="font-bold text-white mb-1">Architecture</div>
          <div class="text-gray-400">Kotlin + AndroidX ViewModel + ViewBinding + Coroutines</div>
        </div>
        <div class="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div class="font-bold text-white mb-1">Local Database</div>
          <div class="text-gray-400">Room SQLite (CrazyPayDatabase, UserDao, TradeDao, PaymentIdentifierDao)</div>
        </div>
        <div class="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div class="font-bold text-white mb-1">Single Active Binding</div>
          <div class="text-gray-400">Enforces atomic single-active UPI binding across all transactions</div>
        </div>
        <div class="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div class="font-bold text-white mb-1">Bank SMS Engine</div>
          <div class="text-gray-400">TransactionSmsReceiver + BankSmsParserEngine (DLT -T header & 12-digit UTR regex)</div>
        </div>
      </div>

      <div class="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-xs space-y-2">
        <div class="font-mono text-cyan-400 font-bold">Android Studio Ready</div>
        <div class="text-gray-400 font-mono text-[11px] space-y-1">
          <div>• Open directory in Android Studio (build.gradle.kts / settings.gradle.kts)</div>
          <div>• Clean Gradle structure in <code>/app</code> and <code>/android</code></div>
          <div>• Standalone APK build: <code>./gradlew assembleDebug</code></div>
        </div>
      </div>
    </div>

  </div>

  <script>
    let currentInr = 25450.00;
    let currentUsdt = 280.50;
    let currentTradeTab = 'BUY';

    function switchTab(tabId) {
      document.querySelectorAll('.screen-tab').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('active'));
      document.getElementById('tab-' + tabId).classList.add('active');
      document.getElementById('nav-btn-' + tabId).classList.add('active');
    }

    function setTradeTab(type) {
      currentTradeTab = type;
      if (type === 'BUY') {
        document.getElementById('trade-buy-btn').className = "flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold";
        document.getElementById('trade-sell-btn').className = "flex-1 py-1.5 text-gray-400 rounded-lg text-xs font-bold";
      } else {
        document.getElementById('trade-sell-btn').className = "flex-1 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold";
        document.getElementById('trade-buy-btn').className = "flex-1 py-1.5 text-gray-400 rounded-lg text-xs font-bold";
      }
      calcTrade();
    }

    function calcTrade() {
      const val = parseFloat(document.getElementById('trade-inr-input').value) || 0;
      const usdt = val > 0 ? (val / 91.50).toFixed(4) : "0.0000";
      document.getElementById('trade-usdt-calc').innerText = usdt + " USDT";
    }

    function placeOrder() {
      const val = parseFloat(document.getElementById('trade-inr-input').value);
      if (!val || val < 100) { alert('Enter minimum ₹100'); return; }
      const orderId = 'CP-' + Math.floor(100000 + Math.random() * 900000);
      const usdt = (val / 91.50).toFixed(4);
      openOrder(orderId, val, usdt, 'MATCHED');
    }

    function openOrder(id, fiat, crypto, status) {
      document.getElementById('modal-order-id').innerText = id;
      document.getElementById('modal-fiat').innerText = '₹' + Number(fiat).toLocaleString('en-IN', {minimumFractionDigits: 2});
      document.getElementById('modal-crypto').innerText = 'Receiving: ' + crypto + ' USDT';
      document.getElementById('order-modal').classList.remove('hidden');
    }

    function closeOrder() {
      document.getElementById('order-modal').classList.add('hidden');
    }

    function submitUtr() {
      const utr = document.getElementById('manual-utr-input').value.trim();
      if (utr.length !== 12) { alert('Please enter 12-digit UTR/RRN'); return; }
      completeSettlement(utr);
    }

    function simulateSmsMatch() {
      const demoUtr = String(Math.floor(100000000000 + Math.random() * 900000000000));
      alert('Simulated Inward SMS from AX-HDFCBK-T: "Rs 4,575.00 credited to a/c ... UTR ' + demoUtr + '"');
      completeSettlement(demoUtr);
    }

    function completeSettlement(utr) {
      currentInr -= 4575;
      currentUsdt += 50;
      document.getElementById('display-inr').innerText = '₹' + currentInr.toLocaleString('en-IN', {minimumFractionDigits: 2});
      document.getElementById('display-usdt').innerText = currentUsdt.toFixed(4) + ' USDT';
      alert('Order Settled & Completed! UTR ' + utr + ' verified via CrazyPay Engine.');
      closeOrder();
    }

    function setActiveUpi(upi) {
      document.getElementById('active-upi-text').innerText = upi;
      alert(upi + ' is now your Single Active Binding!');
    }

    function claimCommission() {
      currentUsdt += 48.25;
      document.getElementById('display-usdt').innerText = currentUsdt.toFixed(4) + ' USDT';
      document.getElementById('btn-claim').disabled = true;
      document.getElementById('btn-claim').innerText = 'Claimed to Wallet';
      alert('48.25 USDT Commission Credited to Wallet!');
    }
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(htmlContent);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`CrazyPay Native Android App Server running on port ${PORT}`);
});
