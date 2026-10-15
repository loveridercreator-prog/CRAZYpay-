# CrazyPay - Standalone Native Android Project (Kotlin & XML)

CrazyPay is a pure, standalone Native Android application built with Kotlin, Android Jetpack, XML Layouts, Room SQLite Database, and WorkManager. All hybrid/Capacitor web wrappers and web assets have been completely unlinked and removed.

---

## 📱 Native Architecture Overview

- **Language & Framework**: Kotlin 1.9+, Android SDK 34, ViewBinding, Material Components
- **Architecture**: MVVM with Coroutines & StateFlow/LiveData
- **Local Database**: Android Jetpack Room (SQLite) with pre-populated initial seed data
- **Single Active Binding**: Enforces atomic single-active UPI identifier policy across all transactions
- **Automated Verification**: Pure Kotlin `BankSmsParserEngine` extracting 12-digit UTR/RRN from authorized Indian transactional bank SMS (`AX-HDFCBK-T`, `BZ-SBIBNK-T`, `VK-ICICIB-T`, etc.) with zero PII logging
- **Background Worker**: Android Jetpack `WorkManager` (`UtrSyncWorker`) with network constraints and exponential backoff retry

---

## 📂 Project Structure

```
.
├── build.gradle.kts                   # Top-level Gradle configuration
├── settings.gradle.kts                # Project & module settings
├── gradle.properties                  # JVM & AndroidX properties
├── gradle/wrapper/                    # Gradle wrapper binaries & properties
├── app/                               # Native Android Application Module
│   ├── build.gradle.kts               # Module dependencies (Room, WorkManager, Material)
│   └── src/main/
│       ├── AndroidManifest.xml        # App declaration, permissions, receiver & activities
│       ├── java/com/crazypay/app/
│       │   ├── CrazyPayApplication.kt # Application class & notification channels
│       │   ├── data/
│       │   │   ├── local/             # Jetpack Room Database
│       │   │   │   ├── CrazyPayDatabase.kt
│       │   │   │   ├── dao/           # UserDao, TradeDao, PaymentIdentifierDao, TransactionNotificationDao
│       │   │   │   └── entities/      # UserEntity, TradeEntity, PaymentIdentifierEntity, etc.
│       │   │   ├── receiver/          # TransactionSmsReceiver (DLT bank SMS listener)
│       │   │   ├── worker/            # UtrSyncWorker (WorkManager background sync)
│       │   │   └── repository/        # CrazyPayRepository (state machine & DB coordination)
│       │   ├── domain/parser/         # BankSmsParserEngine (Pure Kotlin regex extractor)
│       │   └── ui/                    # Native Android Activities & Fragments
│       │       ├── MainActivity.kt    # BottomNavigationView (Home, Trade, UPI, Team, Mine)
│       │       ├── auth/              # AuthActivity (Login/Register with captcha & OTP)
│       │       ├── home/              # HomeFragment (Balances, tickers, recent orders)
│       │       ├── trade/             # TradeFragment & OrderDetailActivity (15m countdown, UPI transfer)
│       │       ├── upi/               # UpiFragment (Single active binding manager)
│       │       ├── team/              # TeamFragment (Referral & commission hub)
│       │       ├── mine/              # MineFragment (Profile, KYC status, biometrics)
│       │       └── adapters/          # TradeAdapter & UpiAccountAdapter (RecyclerView)
│       └── res/
│           ├── layout/                # Native XML screen & dialog layouts
│           ├── values/                # colors.xml, strings.xml, themes.xml
│           ├── drawable/              # Custom shapes, gradients, vector icons
│           └── menu/                  # bottom_nav_menu.xml
```

---

## 🛠️ Opening & Building in Android Studio

1. Open **Android Studio** (Hedgehog, Iguana, Jellyfish, or newer).
2. Select **File > Open...** and select this project directory.
3. Allow Gradle to sync dependencies automatically.
4. Run or build the APK:
   ```bash
   ./gradlew assembleDebug
   ```
   Output APK: `app/build/outputs/apk/debug/app-debug.apk`
