<!-- Modern Efficiency Dashboard - PRD -->
Here is the updated Product Requirements Document.

# Modern Efficiency Dashboard: Noado

## Product Overview

**The Pitch:** Noado transforms the chaotic spreadsheet management of small-scale rental properties into a fluid, automated command center. We replace manual bank reconciliation and messaging with intelligent auto-matching and one-click KakaoTalk workflows.

**For:** Independent "DIY" landlords managing 5-50 units who value precision over enterprise bloat. They care about cash flow visibility and minimizing admin time.

**Device:** desktop

**Design Direction:** "Fluid Automation" – A high-density interface softened by organic curves and calming hues. It balances the rigid structure of financial data with the approachability of modern consumer software.

**Inspired by:** Linear (density/precision), Wealthfront (approachable finance), Shadcn/ui (clean component primitives).

---

## Screens

- **01 Dashboard:** High-level financial health check, AI summary, and urgent action items.
- **02 Rent Collection:** The financial engine – reconciling expected rent vs. actual bank deposits.
- **03 Tenant & Unit Directory:** Master database of properties, contracts, and occupant details.
- **04 Notification Center:** Control tower for automated tenant communication via KakaoTalk.
- **05 Transaction Matcher:** Modal workflow for resolving ambiguous bank payments.

---

## Key Flows

**Flow: Reconciling Monthly Rent**

1.  User starts on **01 Dashboard** -> sees "Arrears: $1,200" alert in KPI card.
2.  User clicks "View Details" -> navigates to **02 Rent Collection**.
3.  Table shows 2 unmatched transactions next to tenant names.
4.  User clicks "Auto-Match" button -> System links payment to tenant based on name/amount.
5.  Status updates to "Paid" -> Row flashes green -> Progress bar hits 100%.

**Flow: Sending Overdue Notices**

1.  User is on **02 Rent Collection** -> filters by status "Overdue".
2.  User selects 3 tenants -> clicks "Send Reminder".
3.  Modal opens showing KakaoTalk preview -> User confirms.
4.  Toast notification: "3 messages sent via KakaoTalk".

---

<details>
<summary>Design System</summary>

## Color Palette

- **Primary:** `#1D3557` - Navigation, Primary Buttons, Headings (Deep Navy)
- **Background:** `#F1FAEE` - Page background (Off-white/Mint hint)
- **Surface:** `#FFFFFF` - Cards, Table backgrounds
- **Accent:** `#457B9D` - Secondary actions, Active states (Steel Blue)
- **Highlight:** `#A8DADC` - Subtle backgrounds, hover states (Light Cyan)
- **Alert:** `#E63946` - Overdue, Errors, Arrears
- **Success:** `#2A9D8F` - Paid status, Positive trends
- **Text Main:** `#1D3557` - Primary text
- **Text Muted:** `#6D7D8B` - Meta data, labels

## Typography

**Font Family:** *Space Grotesk* (Headings - technical but quirky) + *Inter* (Body - readable, dense).

- **H1 (Page Title):** Space Grotesk, 700, 28px, tracking -0.02em
- **H2 (Section Header):** Space Grotesk, 600, 20px
- **H3 (Card Title):** Inter, 600, 14px, uppercase, tracking 0.05em
- **Body:** Inter, 400, 14px, line-height 1.5
- **Table Data:** Inter, 400, 13px (Tabular nums for currency)
- **Badge/Label:** Inter, 500, 12px

**Style Notes:**
- **Soft Geometry:** 12px border radius on cards, 8px on buttons/inputs.
- **Elevation:** Low contrast shadows `0px 4px 20px rgba(29, 53, 87, 0.08)` to lift surface from background without harsh lines.
- **Data Density:** Tight padding (8px-12px) in tables to maximize rows visible without scrolling.

## Design Tokens

```css
:root {
  --color-primary: #1D3557;
  --color-bg: #F1FAEE;
  --color-surface: #FFFFFF;
  --color-accent: #457B9D;
  --color-highlight: #A8DADC;
  --color-alert: #E63946;
  --color-success: #2A9D8F;
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'Inter', sans-serif;
  --radius-card: 12px;
  --radius-btn: 8px;
  --shadow-soft: 0px 4px 20px rgba(29, 53, 87, 0.08);
}
```

</details>

---

<details>
<summary>Screen Specifications</summary>

### 01 Dashboard

**Purpose:** Executive summary of portfolio health, AI-driven insights, and immediate "fire-fighting" triggers.

**Layout:**
- **Left Sidebar (Global Nav):** Fixed width 240px.
    - **Top:** Logo + "Noado".
    - **Center:** Vertical Menu (Dashboard, Rent Collection, Tenants, Notifications).
    - **Bottom:** User Profile + Settings.
- **Main Content Area:**
    - **Header:** "Daily Briefing" AI Summary Section.
    - **Hero:** 6 KPI Cards arranged in a 3x2 Grid.
    - **Bottom:** Split view. Left: "Recent Activity Feed" (60%). Right: "Vacancy Watchlist" (40%).

**Key Elements:**
- **Daily Briefing (AI Summary):** Full-width card at the top.
    - **Background:** Soft gradient using Highlight color (`#A8DADC`).
    - **Content:** Conversational summary text (e.g., "Good morning. You have 3 overdue payments totaling $1,200. Unit 401's lease expires in 15 days.").
    - **Action:** Quick link buttons derived from the text (e.g., "Review Overdue", "See Lease").
- **KPI Cards:** White surface, soft shadow.
    - **Header:** Icon + Metric Name (Muted).
    - **Value:** 32px Space Grotesk (`$42,500`).
    - **Trend:** Small badge `+4.2%` (Green/Red).
    - **Metrics:** Total Expected Rent, Collection % (Circle chart), Total Arrears (Red text), Vacancy Rate, Contracts Expiring (This month), Tax Reserve.
- **Activity Feed:** List of recent auto-actions.
    - Icon (Bank/Message) + Text ("Rent received from Unit 302") + Timestamp.
- **Vacancy Watchlist:** Mini-table of empty units.
    - Columns: Unit #, Days Vacant, Listed Price. Action: "Copy Listing Link".

**States:**
- **Loading:** Skeleton pulses on KPI numbers.
- **Empty:** "Welcome to Noado! Add your first property to see data."

**Interactions:**
- **Hover KPI:** Card lifts slightly (`translate-y-2px`), shadow deepens.
- **Click "Arrears":** Deep links to **02 Rent Collection** with "Overdue" filter active.

---

### 02 Rent Collection

**Purpose:** The core workspace. Matching bank feed transactions to tenant contracts.

**Layout:**
- **Left Sidebar:** Global Navigation.
- **Main Content Area:**
    - **Header:** Title + Date Picker + "Sync Bank" Button (Primary).
    - **Control Bar:** Search (Tenant/Unit), Filters (Status: Paid, Unpaid, Partial), "Send Reminders" (Secondary Action).
    - **Main:** High-density Data Table (Full width).

**Key Elements:**
- **Progress Bar:** Top of page (below Header). Visualizing collection status (e.g., 85% Green, 10% Grey, 5% Red).
- **The Table:**
    - **Row Height:** 48px (Dense).
    - **Cols:** Status (Badge), Unit (Bold), Tenant Name, Due Date, Amount Due, Amount Paid, Balance, Last Msg.
    - **Status Badges:** Pill shape. `Paid` (Solid Green), `Partial` (Yellow outline), `Overdue` (Solid Red).
    - **Action Column:** "..." Menu + "Match" button if status is ambiguous.

**States:**
- **Syncing:** "Syncing Bank..." spinner replaces the Sync button.
- **Mismatch:** Row highlights yellow. "Did you mean transaction: 'KIM MIN-SU 500,000'?"

**Interactions:**
- **Row Click:** Opens sliding side-panel (from right) with detailed payment history for that specific lease.
- **Hover Status:** Tooltip shows exact timestamp of payment.

---

### 03 Tenant & Unit Directory

**Purpose:** Master record of physical assets and legal contracts.

**Layout:**
- **Left Sidebar:** Global Navigation.
- **Main Content Area:**
    - **Header:** "Properties" + "Add Unit" Button.
    - **View Toggle:** Grid (Card view) vs List (Table view). Default: List.
    - **Main:** Table grouped by Building.

**Key Elements:**
- **Building Header:** Sticky row separating units by building address.
- **Tenant Avatar:** Circle with initials.
- **Contract visualizer:** A linear timeline bar in the table cell showing lease start -> end. Current date marked with a vertical line.
    - **Red zone:** < 60 days remaining.
- **Deposit Field:** Formatted currency.

**Components:**
- **Lease Status Badge:** `Active` (Blue), `Notice Given` (Orange), `Vacant` (Grey).

**Responsive:**
- **Desktop:** Full table with timeline visualization.
- **Tablet:** Timeline hidden, replaced by "Days Remaining" text.

---

### 04 Notification Center (KakaoTalk)

**Purpose:** Managing automated communication templates and viewing message logs.

**Layout:**
- **Left Sidebar:** Global Navigation.
- **Internal Sidebar (Left of Content):** Template Categories (Rent Due, Overdue, Contract Renewal, Welcome).
- **Center:** Template Editor / Preview.
- **Right:** Sent Log (History).

**Key Elements:**
- **Template Editor:**
    - **Variables:** Chips user can drag in (`{{tenant_name}}`, `{{amount_due}}`).
    - **Preview Phone:** A visual mock of a smartphone screen showing exactly how the KakaoTalk message looks.
- **Automation Toggle:** "Auto-send on [Date]" switch.
- **Log List:** Vertical timeline of sent messages.
    - Status icons: `Sent` (Check), `Read` (Double Check), `Failed` (Exclamation).

**Interactions:**
- **Edit Template:** Typing in the text area updates the Preview Phone in real-time.
- **Toggle Auto-send:** Modal confirmation "Are you sure you want to automate this? Messages will be sent at 9:00 AM KST."

</details>

---

<details>
<summary>Build Guide</summary>

**Stack:** HTML + Tailwind CSS v3

**Build Order:**
1.  **Global Navigation:** Establish the Left Sidebar layout first as it wraps every screen.
2.  **02 Rent Collection:** This contains the most complex data structures and defines the table component density which is the app's backbone.
3.  **01 Dashboard:** Reuses the data from collection and adds the AI summary component.
4.  **04 Notification Center:** Independent module, can be built in parallel once styles are set.
5.  **03 Tenant Directory:** Standard CRUD, lowest complexity.

**Tailwind Config Highlights:**
- Extend colors with specific semantic names (`bg-surface`, `text-primary`).
- Create a `data-table` utility layer for consistent row heights and cell padding.
- Use `tabular-nums` class for all financial data to ensure alignment.
- Configure sidebar width and main content margin offset.

</details>

<!-- 01 Dashboard -->
<!DOCTYPE html>

<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Noado Dashboard</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&amp;family=Inter:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script>
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "primary": "#1D3557", // Deep Navy from PRD
                        "primary-light": "#457B9D", // Steel Blue
                        "background-light": "#F1FAEE", // Mint hint off-white
                        "background-dark": "#111821",
                        "surface": "#FFFFFF",
                        "alert": "#E63946",
                        "success": "#2A9D8F",
                        "highlight": "#A8DADC",
                        "muted": "#6D7D8B"
                    },
                    fontFamily: {
                        "display": ["Space Grotesk", "sans-serif"],
                        "body": ["Inter", "sans-serif"]
                    },
                    borderRadius: {
                        "DEFAULT": "0.5rem",
                        "lg": "0.75rem", // 12px
                        "xl": "1rem",
                        "2xl": "1.5rem",
                        "full": "9999px"
                    },
                    boxShadow: {
                        "soft": "0px 4px 20px rgba(29, 53, 87, 0.08)",
                    }
                },
            },
        }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        /* Custom scrollbar for webkit */
        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
        }
    </style>
</head>
<body class="bg-background-light text-primary font-body antialiased selection:bg-highlight selection:text-primary">
<div class="flex min-h-screen w-full overflow-hidden">
<!-- Sidebar Navigation -->
<aside class="fixed inset-y-0 left-0 z-50 w-60 flex-col border-r border-slate-200 bg-surface shadow-sm hidden lg:flex">
<div class="flex h-full flex-col justify-between p-4">
<div class="flex flex-col gap-6">
<!-- Brand -->
<div class="flex items-center gap-3 px-2 mt-2">
<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-light text-white shadow-soft">
<span class="material-symbols-outlined text-2xl">apartment</span>
</div>
<div class="flex flex-col">
<h1 class="font-display text-lg font-bold leading-none tracking-tight text-primary">Noado</h1>
<p class="text-xs text-muted font-medium mt-1">Property Manager</p>
</div>
</div>
<!-- Navigation Links -->
<nav class="flex flex-col gap-1.5">
<a class="group flex items-center gap-3 rounded-lg bg-primary/5 px-3 py-2.5 text-primary transition-colors" href="#">
<span class="material-symbols-outlined text-[22px] font-medium" style="font-variation-settings: 'FILL' 1;">dashboard</span>
<span class="text-sm font-medium">Dashboard</span>
</a>
<a class="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted hover:bg-background-light hover:text-primary transition-colors" href="#">
<span class="material-symbols-outlined text-[22px]">payments</span>
<span class="text-sm font-medium">Rent Collection</span>
</a>
<a class="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted hover:bg-background-light hover:text-primary transition-colors" href="#">
<span class="material-symbols-outlined text-[22px]">group</span>
<span class="text-sm font-medium">Tenants</span>
</a>
<a class="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted hover:bg-background-light hover:text-primary transition-colors" href="#">
<span class="material-symbols-outlined text-[22px]">chat</span>
<span class="text-sm font-medium">Notifications</span>
<span class="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-alert/10 text-[10px] font-bold text-alert">3</span>
</a>
</nav>
</div>
<!-- Bottom Actions -->
<div class="flex flex-col gap-4">
<button class="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-soft hover:bg-primary/90 transition-all active:scale-[0.98]">
<span class="material-symbols-outlined text-[18px]">add</span>
<span>Add Unit</span>
</button>
<div class="border-t border-slate-100 pt-4">
<a class="group flex items-center gap-3 rounded-lg px-3 py-2 text-muted hover:bg-background-light hover:text-primary transition-colors" href="#">
<span class="material-symbols-outlined text-[22px]">settings</span>
<span class="text-sm font-medium">Settings</span>
</a>
<div class="mt-2 flex items-center gap-3 rounded-lg px-3 py-2">
<div class="relative h-9 w-9 overflow-hidden rounded-full border border-slate-200" data-alt="User profile avatar gradient">
<img alt="User Avatar" class="h-full w-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAKLcNUVR38Y8r6qLPr6rUquftpyw30fa1Coa8bguohO-MBBY1JJ7TaFuF76GmcUZkFriWxI57y7Xj35a-i7pitdRRCitdmQurJJrxo3lc8LALYqRBU6sBJ_CedFaje7PaBa9c5BoJFoP4CsLku-4b_4OU1wVswomrJ2PuZImsUJa3TO9kV2iCXoCzDv3jy1kVcGa3uXaZg2La2pdzgnQp8dMacnOiuCIYY9xNsUgEQB8SvVovHnSIVKQdh5TfjIv1Gk2lrAGDV9SBV"/>
</div>
<div class="flex flex-col">
<span class="text-sm font-semibold text-primary">Alex Kim</span>
<span class="text-xs text-muted">Logout</span>
</div>
</div>
</div>
</div>
</div>
</aside>
<!-- Main Content -->
<main class="flex-1 lg:ml-60 h-screen overflow-y-auto">
<div class="mx-auto max-w-[1200px] p-6 lg:p-8 flex flex-col gap-8">
<!-- Daily Briefing (AI Summary) -->
<section class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-highlight/30 to-background-light border border-highlight/50 p-6 shadow-sm">
<div class="relative z-10 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
<div class="flex flex-col gap-2 max-w-2xl">
<div class="flex items-center gap-2 text-primary-light mb-1">
<span class="material-symbols-outlined text-lg">auto_awesome</span>
<span class="text-xs font-bold uppercase tracking-wider">Daily Briefing</span>
</div>
<h2 class="font-display text-2xl font-bold text-primary">Good morning, Alex.</h2>
<p class="font-body text-base text-slate-600 leading-relaxed">
                                You have <span class="font-semibold text-alert">3 overdue payments</span> totaling <span class="font-semibold text-primary">$1,200</span>. Unit 401's lease expires in 15 days, requiring your attention.
                            </p>
</div>
<div class="flex flex-shrink-0 gap-3 mt-4 md:mt-0">
<button class="flex items-center gap-2 rounded-lg bg-surface border border-slate-200 px-4 py-2 text-sm font-medium text-primary shadow-sm hover:bg-slate-50 transition-colors">
<span>See Lease</span>
</button>
<button class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-soft hover:bg-primary/90 transition-colors">
<span>Review Overdue</span>
<span class="material-symbols-outlined text-[16px]">arrow_forward</span>
</button>
</div>
</div>
<!-- Decorative background element -->
<div class="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-highlight/20 blur-3xl" data-alt="Abstract soft blur background decoration"></div>
</section>
<!-- KPI Grid -->
<section class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
<!-- KPI Card 1 -->
<div class="group relative flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-soft transition-all hover:-translate-y-1 hover:shadow-md border border-transparent hover:border-slate-100">
<div class="flex items-center justify-between">
<div class="flex items-center gap-2 text-muted">
<span class="material-symbols-outlined text-[20px]">account_balance_wallet</span>
<h3 class="font-body text-xs font-semibold uppercase tracking-wider">Total Expected Rent</h3>
</div>
<span class="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
<span class="material-symbols-outlined mr-0.5 text-[14px]">trending_up</span>
                                +4.2%
                            </span>
</div>
<div>
<p class="font-display text-3xl font-bold tracking-tight text-primary tabular-nums">$42,500</p>
<p class="text-xs text-muted mt-1">vs. last month</p>
</div>
</div>
<!-- KPI Card 2 -->
<div class="group relative flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-soft transition-all hover:-translate-y-1 hover:shadow-md border border-transparent hover:border-slate-100">
<div class="flex items-center justify-between">
<div class="flex items-center gap-2 text-muted">
<span class="material-symbols-outlined text-[20px]">pie_chart</span>
<h3 class="font-body text-xs font-semibold uppercase tracking-wider">Collection Rate</h3>
</div>
<span class="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
<span class="material-symbols-outlined mr-0.5 text-[14px]">trending_up</span>
                                +1.5%
                            </span>
</div>
<div class="flex items-end justify-between">
<div>
<p class="font-display text-3xl font-bold tracking-tight text-primary tabular-nums">85%</p>
<p class="text-xs text-muted mt-1">Target: 95%</p>
</div>
<!-- Mini Circle Chart Visualization -->
<div class="relative h-10 w-10">
<svg class="h-full w-full -rotate-90" viewbox="0 0 36 36">
<path class="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="4"></path>
<path class="text-primary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-dasharray="85, 100" stroke-width="4"></path>
</svg>
</div>
</div>
</div>
<!-- KPI Card 3: Arrears (Actionable) -->
<div class="group relative flex cursor-pointer flex-col gap-4 rounded-xl bg-surface p-5 shadow-soft ring-1 ring-inset ring-transparent transition-all hover:-translate-y-1 hover:shadow-md hover:ring-alert/20">
<div class="flex items-center justify-between">
<div class="flex items-center gap-2 text-muted">
<span class="material-symbols-outlined text-[20px] text-alert">warning</span>
<h3 class="font-body text-xs font-semibold uppercase tracking-wider text-alert">Total Arrears</h3>
</div>
<span class="inline-flex items-center rounded-full bg-alert/10 px-2 py-0.5 text-xs font-medium text-alert">
<span class="material-symbols-outlined mr-0.5 text-[14px]">trending_down</span>
                                -2.0%
                            </span>
</div>
<div>
<p class="font-display text-3xl font-bold tracking-tight text-alert tabular-nums">$1,200</p>
<p class="text-xs text-muted mt-1">3 tenants overdue</p>
</div>
</div>
<!-- KPI Card 4 -->
<div class="group relative flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-soft transition-all hover:-translate-y-1 hover:shadow-md border border-transparent hover:border-slate-100">
<div class="flex items-center justify-between">
<div class="flex items-center gap-2 text-muted">
<span class="material-symbols-outlined text-[20px]">door_open</span>
<h3 class="font-body text-xs font-semibold uppercase tracking-wider">Vacancy Rate</h3>
</div>
<span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-muted">
                                0%
                            </span>
</div>
<div>
<p class="font-display text-3xl font-bold tracking-tight text-primary tabular-nums">4%</p>
<p class="text-xs text-muted mt-1">1 unit vacant</p>
</div>
</div>
<!-- KPI Card 5 -->
<div class="group relative flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-soft transition-all hover:-translate-y-1 hover:shadow-md border border-transparent hover:border-slate-100">
<div class="flex items-center justify-between">
<div class="flex items-center gap-2 text-muted">
<span class="material-symbols-outlined text-[20px]">contract_edit</span>
<h3 class="font-body text-xs font-semibold uppercase tracking-wider">Contracts Expiring</h3>
</div>
</div>
<div>
<p class="font-display text-3xl font-bold tracking-tight text-primary tabular-nums">2</p>
<p class="text-xs text-muted mt-1">This month</p>
</div>
</div>
<!-- KPI Card 6 -->
<div class="group relative flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-soft transition-all hover:-translate-y-1 hover:shadow-md border border-transparent hover:border-slate-100">
<div class="flex items-center justify-between">
<div class="flex items-center gap-2 text-muted">
<span class="material-symbols-outlined text-[20px]">savings</span>
<h3 class="font-body text-xs font-semibold uppercase tracking-wider">Tax Reserve</h3>
</div>
<span class="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
<span class="material-symbols-outlined mr-0.5 text-[14px]">trending_up</span>
                                +5.0%
                            </span>
</div>
<div>
<p class="font-display text-3xl font-bold tracking-tight text-primary tabular-nums">$15,000</p>
<p class="text-xs text-muted mt-1">Autosaved from rent</p>
</div>
</div>
</section>
<!-- Bottom Section: Split View -->
<section class="grid grid-cols-1 gap-6 lg:grid-cols-5">
<!-- Recent Activity Feed (60%) -->
<div class="flex flex-col gap-4 lg:col-span-3">
<div class="flex items-center justify-between px-1">
<h2 class="font-display text-lg font-bold text-primary">Recent Activity</h2>
<button class="text-xs font-medium text-primary-light hover:text-primary transition-colors">View All</button>
</div>
<div class="rounded-xl bg-surface shadow-soft border border-slate-100 overflow-hidden">
<div class="divide-y divide-slate-100">
<!-- Activity Item 1 -->
<div class="group flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors cursor-pointer">
<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
<span class="material-symbols-outlined text-[20px]">account_balance</span>
</div>
<div class="flex flex-1 flex-col gap-0.5">
<p class="text-sm font-medium text-primary">Rent received from Unit 302</p>
<p class="text-xs text-muted">Bank Transfer • PARK JI-MIN</p>
</div>
<span class="text-xs font-medium text-muted">2m ago</span>
</div>
<!-- Activity Item 2 -->
<div class="group flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors cursor-pointer">
<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
<span class="material-symbols-outlined text-[20px]">chat_bubble</span>
</div>
<div class="flex flex-1 flex-col gap-0.5">
<p class="text-sm font-medium text-primary">Reminder sent to Unit 401</p>
<p class="text-xs text-muted">KakaoTalk • Overdue Notice</p>
</div>
<span class="text-xs font-medium text-muted">1h ago</span>
</div>
<!-- Activity Item 3 -->
<div class="group flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors cursor-pointer">
<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-alert/10 text-alert">
<span class="material-symbols-outlined text-[20px]">priority_high</span>
</div>
<div class="flex flex-1 flex-col gap-0.5">
<p class="text-sm font-medium text-primary">Unit 105 Lease Ending Soon</p>
<p class="text-xs text-muted">Action Required • 30 Days Left</p>
</div>
<span class="text-xs font-medium text-muted">4h ago</span>
</div>
<!-- Activity Item 4 -->
<div class="group flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors cursor-pointer">
<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
<span class="material-symbols-outlined text-[20px]">account_balance</span>
</div>
<div class="flex flex-1 flex-col gap-0.5">
<p class="text-sm font-medium text-primary">Rent received from Unit 204</p>
<p class="text-xs text-muted">Bank Transfer • LEE MIN-HO</p>
</div>
<span class="text-xs font-medium text-muted">5h ago</span>
</div>
</div>
</div>
</div>
<!-- Vacancy Watchlist (40%) -->
<div class="flex flex-col gap-4 lg:col-span-2">
<div class="flex items-center justify-between px-1">
<h2 class="font-display text-lg font-bold text-primary">Vacancy Watchlist</h2>
</div>
<div class="rounded-xl bg-surface shadow-soft border border-slate-100 overflow-hidden h-full">
<table class="w-full text-left border-collapse">
<thead class="bg-slate-50 border-b border-slate-100">
<tr>
<th class="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Unit</th>
<th class="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Days</th>
<th class="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider text-right">Price</th>
<th class="px-4 py-3 w-10"></th>
</tr>
</thead>
<tbody class="divide-y divide-slate-100">
<tr class="group hover:bg-slate-50 transition-colors">
<td class="px-4 py-3 text-sm font-semibold text-primary">#502</td>
<td class="px-4 py-3">
<span class="inline-flex items-center rounded-md bg-alert/10 px-2 py-1 text-xs font-medium text-alert">42 days</span>
</td>
<td class="px-4 py-3 text-sm font-medium text-primary text-right tabular-nums">$950</td>
<td class="px-4 py-3 text-right">
<button class="text-muted hover:text-primary transition-colors" title="Copy Listing Link">
<span class="material-symbols-outlined text-[18px]">link</span>
</button>
</td>
</tr>
<tr class="group hover:bg-slate-50 transition-colors">
<td class="px-4 py-3 text-sm font-semibold text-primary">#102</td>
<td class="px-4 py-3">
<span class="inline-flex items-center rounded-md bg-highlight/30 px-2 py-1 text-xs font-medium text-primary-light">12 days</span>
</td>
<td class="px-4 py-3 text-sm font-medium text-primary text-right tabular-nums">$800</td>
<td class="px-4 py-3 text-right">
<button class="text-muted hover:text-primary transition-colors" title="Copy Listing Link">
<span class="material-symbols-outlined text-[18px]">link</span>
</button>
</td>
</tr>
<!-- Empty state placeholder visual -->
<tr class="bg-slate-50/50">
<td class="px-4 py-8 text-center" colspan="4">
<p class="text-xs text-muted italic">No other vacancies</p>
</td>
</tr>
</tbody>
</table>
</div>
</div>
</section>
</div>
</main>
</div>
</body></html>

<!-- 02 Rent Collection -->
<!DOCTYPE html>

<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Noado - Rent Collection</title>
<!-- Fonts -->
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&amp;family=Inter:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet"/>
<!-- Material Symbols -->
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<!-- Tailwind CSS -->
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<!-- Theme Configuration -->
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        primary: "#1D3557", // Deep Navy
                        secondary: "#457B9D", // Steel Blue
                        highlight: "#A8DADC", // Light Cyan
                        bg: "#F1FAEE", // Mint hint off-white
                        surface: "#FFFFFF",
                        alert: "#E63946", // Red
                        success: "#2A9D8F", // Teal/Green
                        muted: "#6D7D8B",
                        "text-main": "#1D3557",
                    },
                    fontFamily: {
                        display: ["Space Grotesk", "sans-serif"],
                        body: ["Inter", "sans-serif"],
                    },
                    boxShadow: {
                        soft: "0px 4px 20px rgba(29, 53, 87, 0.08)",
                    },
                    borderRadius: {
                        DEFAULT: "0.5rem",
                        card: "12px",
                        btn: "8px",
                    }
                },
            },
        }
    </script>
<style>
        /* Custom Scrollbar for the table if needed */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
        }
    </style>
</head>
<body class="bg-bg text-text-main font-body antialiased selection:bg-highlight selection:text-primary h-screen overflow-hidden flex">
<!-- Sidebar -->
<aside class="w-[240px] h-full bg-surface border-r border-slate-100 flex flex-col justify-between shrink-0 z-20 shadow-soft">
<div>
<!-- Logo -->
<div class="h-20 flex items-center px-6 gap-3">
<div class="size-8 rounded-lg bg-primary flex items-center justify-center text-white">
<span class="material-symbols-outlined text-[20px]">apartment</span>
</div>
<h1 class="font-display font-bold text-xl tracking-tight text-primary">Noado</h1>
</div>
<!-- Navigation -->
<nav class="flex flex-col gap-1 px-3 mt-2">
<a class="flex items-center gap-3 px-3 py-2.5 rounded-btn text-muted hover:bg-bg hover:text-primary transition-colors group" href="#">
<span class="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">dashboard</span>
<span class="font-medium text-sm">Dashboard</span>
</a>
<a class="flex items-center gap-3 px-3 py-2.5 rounded-btn bg-primary/5 text-primary transition-colors group relative" href="#">
<div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full"></div>
<span class="material-symbols-outlined text-[20px] font-semibold filled">account_balance_wallet</span>
<span class="font-semibold text-sm">Rent Collection</span>
</a>
<a class="flex items-center gap-3 px-3 py-2.5 rounded-btn text-muted hover:bg-bg hover:text-primary transition-colors group" href="#">
<span class="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">people</span>
<span class="font-medium text-sm">Tenants &amp; Units</span>
</a>
<a class="flex items-center gap-3 px-3 py-2.5 rounded-btn text-muted hover:bg-bg hover:text-primary transition-colors group justify-between" href="#">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">notifications</span>
<span class="font-medium text-sm">Notifications</span>
</div>
<span class="bg-alert text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">3</span>
</a>
</nav>
</div>
<!-- Bottom Actions -->
<div class="p-4 border-t border-slate-100 flex flex-col gap-1">
<a class="flex items-center gap-3 px-3 py-2.5 rounded-btn text-muted hover:bg-bg hover:text-primary transition-colors group" href="#">
<span class="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">settings</span>
<span class="font-medium text-sm">Settings</span>
</a>
<div class="mt-2 flex items-center gap-3 px-3 py-3 rounded-card bg-bg border border-slate-100 cursor-pointer hover:border-highlight transition-colors">
<div class="size-8 rounded-full bg-highlight/30 flex items-center justify-center text-secondary font-bold text-xs">
                    JD
                </div>
<div class="flex flex-col">
<span class="text-xs font-semibold text-primary">John Doe</span>
<span class="text-[10px] text-muted">Pro Plan</span>
</div>
</div>
</div>
</aside>
<!-- Main Content -->
<main class="flex-1 h-full flex flex-col overflow-hidden relative">
<!-- Header -->
<header class="h-20 shrink-0 px-8 flex items-center justify-between bg-bg/50 backdrop-blur-sm sticky top-0 z-10">
<div class="flex flex-col">
<h2 class="font-display font-bold text-2xl text-primary tracking-tight">Rent Collection</h2>
<div class="flex items-center gap-2 text-muted text-sm mt-0.5">
<button class="hover:text-primary transition-colors">
<span class="material-symbols-outlined text-[16px] align-middle">chevron_left</span>
</button>
<span class="font-medium font-display text-primary">October 2023</span>
<button class="hover:text-primary transition-colors">
<span class="material-symbols-outlined text-[16px] align-middle">chevron_right</span>
</button>
</div>
</div>
<div class="flex items-center gap-3">
<div class="text-right mr-2 hidden md:block">
<p class="text-xs text-muted font-medium uppercase tracking-wider">Last synced</p>
<p class="text-xs font-semibold text-primary">Just now</p>
</div>
<button class="flex items-center gap-2 bg-primary text-white hover:bg-primary/90 transition-all active:scale-95 px-4 py-2.5 rounded-btn shadow-lg shadow-primary/20 group">
<span class="material-symbols-outlined text-[18px] group-hover:animate-spin">sync</span>
<span class="font-medium text-sm">Sync Bank</span>
</button>
</div>
</header>
<!-- Scrollable Content -->
<div class="flex-1 overflow-y-auto px-8 pb-8">
<!-- Progress Section -->
<div class="mb-8 w-full max-w-7xl mx-auto">
<div class="flex items-end justify-between mb-2">
<div class="flex flex-col">
<span class="text-sm font-medium text-muted">Collection Progress</span>
<div class="flex items-baseline gap-2">
<span class="text-3xl font-display font-bold text-primary">85%</span>
<span class="text-sm font-medium text-muted">of expected $50,000</span>
</div>
</div>
<div class="flex gap-4 text-xs font-medium">
<div class="flex items-center gap-1.5">
<div class="size-2 rounded-full bg-success"></div>
<span class="text-success">$42,500 Paid</span>
</div>
<div class="flex items-center gap-1.5">
<div class="size-2 rounded-full bg-slate-300"></div>
<span class="text-slate-500">$5,100 Pending</span>
</div>
<div class="flex items-center gap-1.5">
<div class="size-2 rounded-full bg-alert"></div>
<span class="text-alert">$2,400 Overdue</span>
</div>
</div>
</div>
<!-- Multi-segment Progress Bar -->
<div class="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
<div class="h-full bg-success w-[85%] hover:opacity-90 transition-opacity cursor-pointer relative group">
<div class="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-primary text-white text-xs px-2 py-1 rounded whitespace-nowrap transition-opacity pointer-events-none">
                            45 Units Paid
                        </div>
</div>
<div class="h-full bg-slate-300 w-[10%] hover:opacity-90 transition-opacity cursor-pointer relative group">
<div class="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-primary text-white text-xs px-2 py-1 rounded whitespace-nowrap transition-opacity pointer-events-none">
                            5 Units Pending
                        </div>
</div>
<div class="h-full bg-alert w-[5%] hover:opacity-90 transition-opacity cursor-pointer relative group">
<div class="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-primary text-white text-xs px-2 py-1 rounded whitespace-nowrap transition-opacity pointer-events-none">
                            2 Units Overdue
                        </div>
</div>
</div>
</div>
<!-- Filters & Actions Toolbar -->
<div class="flex flex-col md:flex-row gap-4 justify-between items-center mb-4 max-w-7xl mx-auto">
<div class="flex items-center gap-3 w-full md:w-auto">
<!-- Search -->
<div class="relative group">
<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors text-[20px]">search</span>
<input class="pl-10 pr-4 py-2 w-full md:w-64 bg-surface border border-slate-200 rounded-btn text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400" placeholder="Search tenant or unit..." type="text"/>
</div>
<!-- Filters -->
<div class="flex items-center bg-surface border border-slate-200 p-1 rounded-btn shadow-sm">
<button class="px-3 py-1 text-xs font-medium rounded text-primary bg-bg shadow-sm transition-all">All</button>
<button class="px-3 py-1 text-xs font-medium rounded text-muted hover:text-primary hover:bg-slate-50 transition-all">Unpaid</button>
<button class="px-3 py-1 text-xs font-medium rounded text-muted hover:text-primary hover:bg-slate-50 transition-all">Partial</button>
<button class="px-3 py-1 text-xs font-medium rounded text-alert/80 hover:text-alert hover:bg-alert/5 transition-all">Overdue</button>
</div>
</div>
<div class="flex gap-3 w-full md:w-auto justify-end">
<button class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-secondary bg-white border border-secondary/20 rounded-btn hover:bg-secondary/5 hover:border-secondary/40 transition-colors shadow-sm">
<span class="material-symbols-outlined text-[18px]">send</span>
                        Send Reminders
                    </button>
</div>
</div>
<!-- Data Table Card -->
<div class="bg-surface rounded-card shadow-soft border border-slate-100 overflow-hidden max-w-7xl mx-auto mb-10">
<div class="overflow-x-auto">
<table class="w-full text-left border-collapse">
<thead>
<tr class="bg-slate-50/50 border-b border-slate-100 text-xs uppercase tracking-wider text-muted font-medium">
<th class="pl-6 pr-4 py-3 w-[40px]">
<input class="rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer" type="checkbox"/>
</th>
<th class="px-4 py-3">Status</th>
<th class="px-4 py-3">Unit</th>
<th class="px-4 py-3">Tenant</th>
<th class="px-4 py-3">Due Date</th>
<th class="px-4 py-3 text-right">Amount Due</th>
<th class="px-4 py-3 text-right">Paid</th>
<th class="px-4 py-3 text-right">Balance</th>
<th class="px-4 py-3 w-[140px]">Last Msg</th>
<th class="px-4 py-3 w-[60px]"></th>
</tr>
</thead>
<tbody class="text-sm divide-y divide-slate-100">
<!-- Row 1: Overdue -->
<tr class="group hover:bg-slate-50 transition-colors cursor-pointer relative">
<td class="pl-6 pr-4 py-3">
<input class="rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer" type="checkbox"/>
</td>
<td class="px-4 py-3">
<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-alert/10 text-alert border border-alert/20">
                                        Overdue
                                    </span>
</td>
<td class="px-4 py-3 font-display font-semibold text-primary">402</td>
<td class="px-4 py-3 font-medium text-text-main">
<div class="flex items-center gap-2">
<div class="size-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-bold">PJ</div>
                                        Park Ji-yoon
                                    </div>
</td>
<td class="px-4 py-3 text-muted tabular-nums">Oct 01</td>
<td class="px-4 py-3 text-right tabular-nums font-medium">$1,200.00</td>
<td class="px-4 py-3 text-right tabular-nums text-muted">$0.00</td>
<td class="px-4 py-3 text-right tabular-nums font-bold text-alert">-$1,200.00</td>
<td class="px-4 py-3">
<span class="text-xs text-muted flex items-center gap-1">
<span class="material-symbols-outlined text-[14px]">schedule</span> 2d ago
                                    </span>
</td>
<td class="px-4 py-3 text-right">
<button class="p-1 rounded hover:bg-slate-200 text-muted hover:text-primary transition-colors">
<span class="material-symbols-outlined">more_horiz</span>
</button>
</td>
</tr>
<!-- Row 2: Partial / Mismatch -->
<tr class="group hover:bg-slate-50 transition-colors cursor-pointer bg-yellow-50/30">
<td class="pl-6 pr-4 py-3">
<input class="rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer" type="checkbox"/>
</td>
<td class="px-4 py-3">
<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200">
                                        Partial
                                    </span>
</td>
<td class="px-4 py-3 font-display font-semibold text-primary">105</td>
<td class="px-4 py-3 font-medium text-text-main">
<div class="flex items-center gap-2">
<div class="size-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">LW</div>
                                        Lee Wei
                                    </div>
</td>
<td class="px-4 py-3 text-muted tabular-nums">Oct 05</td>
<td class="px-4 py-3 text-right tabular-nums font-medium">$800.00</td>
<td class="px-4 py-3 text-right tabular-nums text-muted">$400.00</td>
<td class="px-4 py-3 text-right tabular-nums font-bold text-yellow-600">-$400.00</td>
<td class="px-4 py-3">
<button class="text-xs font-medium text-primary hover:underline bg-white border border-primary/20 px-2 py-1 rounded shadow-sm hover:shadow-md transition-all flex items-center gap-1 w-fit">
<span class="material-symbols-outlined text-[14px]">link</span> Match
                                    </button>
</td>
<td class="px-4 py-3 text-right">
<button class="p-1 rounded hover:bg-slate-200 text-muted hover:text-primary transition-colors">
<span class="material-symbols-outlined">more_horiz</span>
</button>
</td>
</tr>
<!-- Row 3: Paid -->
<tr class="group hover:bg-slate-50 transition-colors cursor-pointer">
<td class="pl-6 pr-4 py-3">
<input class="rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer" type="checkbox"/>
</td>
<td class="px-4 py-3">
<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/20">
                                        Paid
                                    </span>
</td>
<td class="px-4 py-3 font-display font-semibold text-primary">301</td>
<td class="px-4 py-3 font-medium text-text-main">
<div class="flex items-center gap-2">
<div class="size-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold">KM</div>
                                        Kim Min-su
                                    </div>
</td>
<td class="px-4 py-3 text-muted tabular-nums">Oct 01</td>
<td class="px-4 py-3 text-right tabular-nums font-medium">$500.00</td>
<td class="px-4 py-3 text-right tabular-nums font-medium text-success">$500.00</td>
<td class="px-4 py-3 text-right tabular-nums text-slate-300">-</td>
<td class="px-4 py-3">
<span class="text-xs text-muted flex items-center gap-1">
<span class="material-symbols-outlined text-[14px] text-success">done_all</span> Seen
                                    </span>
</td>
<td class="px-4 py-3 text-right">
<button class="p-1 rounded hover:bg-slate-200 text-muted hover:text-primary transition-colors">
<span class="material-symbols-outlined">more_horiz</span>
</button>
</td>
</tr>
<!-- Row 4: Paid -->
<tr class="group hover:bg-slate-50 transition-colors cursor-pointer">
<td class="pl-6 pr-4 py-3">
<input class="rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer" type="checkbox"/>
</td>
<td class="px-4 py-3">
<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/20">
                                        Paid
                                    </span>
</td>
<td class="px-4 py-3 font-display font-semibold text-primary">302</td>
<td class="px-4 py-3 font-medium text-text-main">
<div class="flex items-center gap-2">
<div class="size-6 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center text-[10px] font-bold">SJ</div>
                                        Sarah Jenkins
                                    </div>
</td>
<td class="px-4 py-3 text-muted tabular-nums">Oct 01</td>
<td class="px-4 py-3 text-right tabular-nums font-medium">$550.00</td>
<td class="px-4 py-3 text-right tabular-nums font-medium text-success">$550.00</td>
<td class="px-4 py-3 text-right tabular-nums text-slate-300">-</td>
<td class="px-4 py-3">
<span class="text-xs text-muted flex items-center gap-1">
<span class="material-symbols-outlined text-[14px] text-success">done_all</span> Seen
                                    </span>
</td>
<td class="px-4 py-3 text-right">
<button class="p-1 rounded hover:bg-slate-200 text-muted hover:text-primary transition-colors">
<span class="material-symbols-outlined">more_horiz</span>
</button>
</td>
</tr>
<!-- Row 5: Paid -->
<tr class="group hover:bg-slate-50 transition-colors cursor-pointer">
<td class="pl-6 pr-4 py-3">
<input class="rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer" type="checkbox"/>
</td>
<td class="px-4 py-3">
<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/20">
                                        Paid
                                    </span>
</td>
<td class="px-4 py-3 font-display font-semibold text-primary">204</td>
<td class="px-4 py-3 font-medium text-text-main">
<div class="flex items-center gap-2">
<div class="size-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">DL</div>
                                        David Lee
                                    </div>
</td>
<td class="px-4 py-3 text-muted tabular-nums">Oct 02</td>
<td class="px-4 py-3 text-right tabular-nums font-medium">$600.00</td>
<td class="px-4 py-3 text-right tabular-nums font-medium text-success">$600.00</td>
<td class="px-4 py-3 text-right tabular-nums text-slate-300">-</td>
<td class="px-4 py-3">
<span class="text-xs text-muted flex items-center gap-1">
<span class="material-symbols-outlined text-[14px]">done</span> Sent
                                    </span>
</td>
<td class="px-4 py-3 text-right">
<button class="p-1 rounded hover:bg-slate-200 text-muted hover:text-primary transition-colors">
<span class="material-symbols-outlined">more_horiz</span>
</button>
</td>
</tr>
<!-- Row 6: Unpaid/Pending -->
<tr class="group hover:bg-slate-50 transition-colors cursor-pointer">
<td class="pl-6 pr-4 py-3">
<input class="rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer" type="checkbox"/>
</td>
<td class="px-4 py-3">
<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                        Pending
                                    </span>
</td>
<td class="px-4 py-3 font-display font-semibold text-primary">501</td>
<td class="px-4 py-3 font-medium text-text-main">
<div class="flex items-center gap-2">
<div class="size-6 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-[10px] font-bold">EM</div>
                                        Emma Martinez
                                    </div>
</td>
<td class="px-4 py-3 text-muted tabular-nums">Oct 15</td>
<td class="px-4 py-3 text-right tabular-nums font-medium">$1,100.00</td>
<td class="px-4 py-3 text-right tabular-nums text-muted">$0.00</td>
<td class="px-4 py-3 text-right tabular-nums text-slate-500">$1,100.00</td>
<td class="px-4 py-3">
<span class="text-xs text-muted italic">No history</span>
</td>
<td class="px-4 py-3 text-right">
<button class="p-1 rounded hover:bg-slate-200 text-muted hover:text-primary transition-colors">
<span class="material-symbols-outlined">more_horiz</span>
</button>
</td>
</tr>
</tbody>
</table>
</div>
<!-- Pagination / Footer -->
<div class="bg-slate-50 border-t border-slate-100 px-6 py-3 flex items-center justify-between text-xs text-muted">
<span>Showing 6 of 52 records</span>
<div class="flex gap-1">
<button class="px-2 py-1 rounded border border-slate-200 hover:bg-white disabled:opacity-50" disabled="">Prev</button>
<button class="px-2 py-1 rounded border border-slate-200 hover:bg-white">1</button>
<button class="px-2 py-1 rounded border border-slate-200 hover:bg-white">2</button>
<button class="px-2 py-1 rounded border border-slate-200 hover:bg-white">Next</button>
</div>
</div>
</div>
</div>
<!-- Sliding Side Panel Overlay (Hidden by default, shown conceptually as per req) -->
<!-- In a real app, this would be toggled. Here it's hidden to show the clean table. -->
<!-- 
        <div class="absolute inset-0 bg-black/20 z-40"></div>
        <div class="absolute right-0 top-0 bottom-0 w-[400px] bg-white shadow-2xl z-50 p-6 flex flex-col gap-4 border-l border-slate-100 transform translate-x-0 transition-transform">
             Side panel content would go here
        </div>
        -->
</main>
</body></html>

<!-- 03 Tenant & Unit Directory -->
<!DOCTYPE html>

<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Noado - Tenant &amp; Unit Directory</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=Space+Grotesk:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "primary": "#1D3557",
              "primary-light": "#457B9D",
              "background-light": "#F1FAEE",
              "background-dark": "#111821",
              "surface": "#FFFFFF",
              "accent": "#457B9D",
              "highlight": "#A8DADC",
              "alert": "#E63946",
              "success": "#2A9D8F",
              "text-main": "#1D3557",
              "text-muted": "#6D7D8B",
            },
            fontFamily: {
              "display": ["Space Grotesk", "sans-serif"],
              "body": ["Inter", "sans-serif"],
            },
            borderRadius: {
              "DEFAULT": "0.5rem",
              "lg": "0.75rem", // 12px
              "xl": "1rem",
              "full": "9999px"
            },
            boxShadow: {
              "soft": "0px 4px 20px rgba(29, 53, 87, 0.08)",
            }
          },
        },
      }
    </script>
<style>
        body {
            font-family: 'Inter', sans-serif;
        }
        h1, h2, h3, h4, h5, h6 {
            font-family: 'Space Grotesk', sans-serif;
        }
        /* Hide scrollbar for clean UI */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        ::-webkit-scrollbar-track {
            background: transparent; 
        }
        ::-webkit-scrollbar-thumb {
            background: #cbd5e1; 
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #94a3b8; 
        }
    </style>
</head>
<body class="bg-background-light dark:bg-background-dark text-text-main antialiased overflow-hidden">
<div class="flex h-screen w-full">
<!-- Left Sidebar -->
<aside class="flex w-[240px] flex-col justify-between border-r border-[#E2E8F0] bg-white h-full shrink-0 z-20">
<div class="flex flex-col h-full">
<!-- Logo Area -->
<div class="flex items-center gap-3 px-6 py-6">
<div class="bg-primary aspect-square rounded-lg size-8 flex items-center justify-center text-white">
<span class="material-symbols-outlined text-[20px]">apartment</span>
</div>
<div class="flex flex-col">
<h1 class="text-text-main text-xl font-bold leading-none tracking-tight">Noado</h1>
<p class="text-text-muted text-xs font-medium mt-0.5">Rental Manager</p>
</div>
</div>
<!-- Navigation Links -->
<nav class="flex-1 px-3 space-y-1 mt-2">
<a class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-main hover:bg-background-light group transition-colors" href="#">
<span class="material-symbols-outlined text-text-muted group-hover:text-primary transition-colors">dashboard</span>
<span class="text-sm font-medium">Dashboard</span>
</a>
<a class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-main hover:bg-background-light group transition-colors" href="#">
<span class="material-symbols-outlined text-text-muted group-hover:text-primary transition-colors">account_balance_wallet</span>
<span class="text-sm font-medium">Rent Collection</span>
<span class="ml-auto bg-alert text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">2</span>
</a>
<a class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/10 text-primary font-medium group transition-colors" href="#">
<span class="material-symbols-outlined text-primary fill-current">people</span>
<span class="text-sm">Tenants &amp; Units</span>
</a>
<a class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-main hover:bg-background-light group transition-colors" href="#">
<span class="material-symbols-outlined text-text-muted group-hover:text-primary transition-colors">notifications</span>
<span class="text-sm font-medium">Notifications</span>
</a>
</nav>
<!-- Bottom Profile -->
<div class="p-4 border-t border-[#E2E8F0]">
<div class="flex items-center gap-3 p-2 rounded-lg hover:bg-background-light cursor-pointer transition-colors">
<div class="size-9 rounded-full bg-slate-200 overflow-hidden relative">
<img alt="User Profile" class="object-cover w-full h-full" data-alt="Portrait of a user" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvHhJn7hE67DFXV86J294-rd86TPapXju-poPQp3WduIFE6Z21oQ4DXi-KHGISk7uGB0clAt83SL5HV9bRwzWnrGsV7Dt1umKhDGgftGRhhzqsnFMTLnSWNxwAWv2_RKK6gfQV7iqs1ac4V6kWsIAadUZIeyIgsjxhUDpIsnAfGd376jpZtOOJOvacYNrM6jWpkzqHJXTJkKd0rTEcr1NHy1QDNNcKzjZcyOB-XovIhqm5JCW0yoOzcnO3svYYHYNkdDziy9GS7XFY"/>
</div>
<div class="flex flex-col min-w-0">
<p class="text-sm font-semibold text-text-main truncate">Alex Morgan</p>
<p class="text-xs text-text-muted truncate">Owner</p>
</div>
<span class="material-symbols-outlined text-text-muted ml-auto text-[20px]">settings</span>
</div>
</div>
</div>
</aside>
<!-- Main Content -->
<main class="flex-1 flex flex-col h-full overflow-hidden relative">
<!-- Top Header -->
<header class="h-16 border-b border-[#E2E8F0] bg-white flex items-center justify-between px-8 shrink-0 z-10">
<div class="flex items-center gap-4">
<h2 class="text-2xl font-bold text-text-main tracking-tight">Property Directory</h2>
<div class="h-6 w-px bg-slate-200 mx-2"></div>
<div class="flex items-center gap-2 text-sm text-text-muted">
<span class="font-medium text-text-main">3</span> Buildings
                    <span class="w-1 h-1 rounded-full bg-slate-300"></span>
<span class="font-medium text-text-main">24</span> Units
                </div>
</div>
<div class="flex items-center gap-3">
<button class="flex items-center justify-center size-9 rounded-lg border border-slate-200 hover:bg-slate-50 text-text-muted transition-colors" title="Export Data">
<span class="material-symbols-outlined text-[20px]">download</span>
</button>
<button class="flex items-center gap-2 bg-primary hover:bg-[#152a45] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
<span class="material-symbols-outlined text-[18px]">add</span>
<span>Add Unit</span>
</button>
</div>
</header>
<!-- Main Content Scroll Area -->
<div class="flex-1 overflow-y-auto p-8 pb-20">
<!-- Controls Bar -->
<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
<!-- Search & Filters -->
<div class="flex flex-1 w-full sm:w-auto gap-3">
<div class="relative flex-1 max-w-md">
<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[20px]">search</span>
<input class="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-sm text-text-main placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" placeholder="Search tenant, unit, or building..." type="text"/>
</div>
<div class="relative">
<select class="appearance-none pl-4 pr-10 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer shadow-sm">
<option>All Buildings</option>
<option>Sunrise Apartments</option>
<option>Maple Street Duplex</option>
<option>Riverside Lofts</option>
</select>
<span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none text-[20px]">expand_more</span>
</div>
<div class="relative hidden lg:block">
<select class="appearance-none pl-4 pr-10 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer shadow-sm">
<option>All Statuses</option>
<option>Active</option>
<option>Notice Given</option>
<option>Vacant</option>
</select>
<span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none text-[20px]">expand_more</span>
</div>
</div>
<!-- View Toggle -->
<div class="flex bg-white p-1 rounded-lg border border-[#E2E8F0] shadow-sm">
<button class="px-3 py-1.5 rounded flex items-center gap-2 text-sm font-medium bg-primary/10 text-primary transition-colors">
<span class="material-symbols-outlined text-[18px]">list</span>
<span>List</span>
</button>
<button class="px-3 py-1.5 rounded flex items-center gap-2 text-sm font-medium text-text-muted hover:text-text-main transition-colors">
<span class="material-symbols-outlined text-[18px]">grid_view</span>
<span>Grid</span>
</button>
</div>
</div>
<!-- Building Group 1 -->
<div class="mb-8 bg-white rounded-lg shadow-soft border border-[#E2E8F0] overflow-hidden">
<!-- Sticky Header -->
<div class="sticky top-0 z-10 bg-slate-50 border-b border-[#E2E8F0] px-6 py-3 flex items-center justify-between">
<div class="flex items-center gap-3">
<div class="bg-white p-1.5 rounded-md border border-[#E2E8F0] shadow-sm">
<span class="material-symbols-outlined text-primary text-[20px]">location_city</span>
</div>
<div>
<h3 class="text-base font-bold text-text-main leading-tight">Sunrise Apartments</h3>
<p class="text-xs text-text-muted">1248 Sunrise Blvd • 12 Units</p>
</div>
</div>
<div class="flex items-center gap-4">
<div class="text-xs font-medium text-text-muted bg-white border border-[#E2E8F0] px-2 py-1 rounded">
<span class="text-success mr-1">●</span> 100% Occupied
                        </div>
<button class="text-text-muted hover:text-primary transition-colors">
<span class="material-symbols-outlined text-[20px]">more_horiz</span>
</button>
</div>
</div>
<!-- Table Header -->
<div class="grid grid-cols-12 gap-4 px-6 py-3 border-b border-[#E2E8F0] bg-white text-xs font-semibold text-text-muted uppercase tracking-wider">
<div class="col-span-3">Unit / Tenant</div>
<div class="col-span-2">Contract</div>
<div class="col-span-4 text-center">Lease Timeline</div>
<div class="col-span-2 text-right">Deposit</div>
<div class="col-span-1 text-right">Actions</div>
</div>
<!-- Table Rows -->
<div class="divide-y divide-[#E2E8F0]">
<!-- Row 1: Healthy -->
<div class="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors group">
<div class="col-span-3 flex items-center gap-4">
<div class="flex flex-col items-center justify-center bg-background-light rounded-lg h-10 w-12 border border-slate-200 shrink-0">
<span class="font-display font-bold text-text-main text-sm">101</span>
</div>
<div class="flex items-center gap-3 min-w-0">
<div class="size-9 rounded-full bg-[#E0E7FF] text-[#3730A3] flex items-center justify-center text-xs font-bold shrink-0">SJ</div>
<div class="flex flex-col min-w-0">
<p class="text-sm font-medium text-text-main truncate">Sarah Jenkins</p>
<p class="text-xs text-text-muted truncate">Active • Since 2021</p>
</div>
</div>
</div>
<div class="col-span-2 flex flex-col justify-center">
<span class="inline-flex items-center w-fit px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#D1FAE5] text-[#065F46] mb-1">
                                Active
                            </span>
<span class="text-xs text-text-muted font-medium tabular-nums">Ends Dec 31, 2024</span>
</div>
<div class="col-span-4 flex flex-col justify-center px-4">
<!-- Timeline Component -->
<div class="relative w-full h-8 flex items-center group/timeline cursor-pointer">
<!-- Track -->
<div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
<!-- Progress Bar -->
<div class="h-full bg-primary rounded-full" style="width: 45%;"></div>
</div>
<!-- Markers -->
<div class="absolute left-0 top-6 text-[10px] text-text-muted font-medium">Jan '23</div>
<div class="absolute right-0 top-6 text-[10px] text-text-muted font-medium">Dec '24</div>
<!-- Today Marker -->
<div class="absolute top-1/2 -translate-y-1/2 h-4 w-0.5 bg-text-main z-10" style="left: 45%;"></div>
<div class="absolute top-[-8px] -translate-x-1/2 bg-text-main text-white text-[9px] font-bold px-1.5 rounded opacity-0 group-hover/timeline:opacity-100 transition-opacity" style="left: 45%;">
                                    Today
                                </div>
</div>
</div>
<div class="col-span-2 text-right">
<span class="text-sm font-medium text-text-main tabular-nums">$2,400.00</span>
</div>
<div class="col-span-1 flex justify-end">
<button class="p-1.5 hover:bg-slate-200 rounded-md text-text-muted transition-colors">
<span class="material-symbols-outlined text-[20px]">more_vert</span>
</button>
</div>
</div>
<!-- Row 2: Expiring Soon -->
<div class="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors group">
<div class="col-span-3 flex items-center gap-4">
<div class="flex flex-col items-center justify-center bg-background-light rounded-lg h-10 w-12 border border-slate-200 shrink-0">
<span class="font-display font-bold text-text-main text-sm">102</span>
</div>
<div class="flex items-center gap-3 min-w-0">
<div class="size-9 rounded-full bg-[#FFEDD5] text-[#9A3412] flex items-center justify-center text-xs font-bold shrink-0">MR</div>
<div class="flex flex-col min-w-0">
<p class="text-sm font-medium text-text-main truncate">Mike Ross</p>
<p class="text-xs text-text-muted truncate">Notice Given • Moving out</p>
</div>
</div>
</div>
<div class="col-span-2 flex flex-col justify-center">
<span class="inline-flex items-center w-fit px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FFEDD5] text-[#9A3412] mb-1">
                                Notice Given
                            </span>
<span class="text-xs text-alert font-bold tabular-nums">Ends in 24 days</span>
</div>
<div class="col-span-4 flex flex-col justify-center px-4">
<!-- Timeline Component (Warning) -->
<div class="relative w-full h-8 flex items-center group/timeline cursor-pointer">
<!-- Track -->
<div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
<!-- Progress Bar Red -->
<div class="h-full bg-alert rounded-full" style="width: 92%;"></div>
</div>
<!-- Markers -->
<div class="absolute left-0 top-6 text-[10px] text-text-muted font-medium">Mar '23</div>
<div class="absolute right-0 top-6 text-[10px] text-alert font-bold">Nov '23</div>
<!-- Today Marker -->
<div class="absolute top-1/2 -translate-y-1/2 h-4 w-0.5 bg-alert z-10" style="left: 92%;"></div>
</div>
</div>
<div class="col-span-2 text-right">
<span class="text-sm font-medium text-text-main tabular-nums">$2,200.00</span>
</div>
<div class="col-span-1 flex justify-end">
<button class="p-1.5 hover:bg-slate-200 rounded-md text-text-muted transition-colors">
<span class="material-symbols-outlined text-[20px]">more_vert</span>
</button>
</div>
</div>
<!-- Row 3: Standard -->
<div class="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors group">
<div class="col-span-3 flex items-center gap-4">
<div class="flex flex-col items-center justify-center bg-background-light rounded-lg h-10 w-12 border border-slate-200 shrink-0">
<span class="font-display font-bold text-text-main text-sm">103</span>
</div>
<div class="flex items-center gap-3 min-w-0">
<div class="size-9 rounded-full bg-[#FCE7F3] text-[#9D174D] flex items-center justify-center text-xs font-bold shrink-0">AL</div>
<div class="flex flex-col min-w-0">
<p class="text-sm font-medium text-text-main truncate">Anna Lee</p>
<p class="text-xs text-text-muted truncate">Active • Renewal</p>
</div>
</div>
</div>
<div class="col-span-2 flex flex-col justify-center">
<span class="inline-flex items-center w-fit px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#D1FAE5] text-[#065F46] mb-1">
                                Active
                            </span>
<span class="text-xs text-text-muted font-medium tabular-nums">Ends Jun 15, 2025</span>
</div>
<div class="col-span-4 flex flex-col justify-center px-4">
<!-- Timeline Component -->
<div class="relative w-full h-8 flex items-center group/timeline cursor-pointer">
<div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
<div class="h-full bg-primary rounded-full" style="width: 15%;"></div>
</div>
<div class="absolute left-0 top-6 text-[10px] text-text-muted font-medium">Jun '24</div>
<div class="absolute right-0 top-6 text-[10px] text-text-muted font-medium">Jun '25</div>
<div class="absolute top-1/2 -translate-y-1/2 h-4 w-0.5 bg-text-main z-10" style="left: 15%;"></div>
</div>
</div>
<div class="col-span-2 text-right">
<span class="text-sm font-medium text-text-main tabular-nums">$2,500.00</span>
</div>
<div class="col-span-1 flex justify-end">
<button class="p-1.5 hover:bg-slate-200 rounded-md text-text-muted transition-colors">
<span class="material-symbols-outlined text-[20px]">more_vert</span>
</button>
</div>
</div>
</div>
</div>
<!-- Building Group 2 -->
<div class="mb-8 bg-white rounded-lg shadow-soft border border-[#E2E8F0] overflow-hidden">
<!-- Sticky Header -->
<div class="sticky top-0 z-10 bg-slate-50 border-b border-[#E2E8F0] px-6 py-3 flex items-center justify-between">
<div class="flex items-center gap-3">
<div class="bg-white p-1.5 rounded-md border border-[#E2E8F0] shadow-sm">
<span class="material-symbols-outlined text-primary text-[20px]">home_work</span>
</div>
<div>
<h3 class="text-base font-bold text-text-main leading-tight">Maple Street Duplex</h3>
<p class="text-xs text-text-muted">42 Maple St • 2 Units</p>
</div>
</div>
<div class="flex items-center gap-4">
<div class="text-xs font-medium text-text-muted bg-white border border-[#E2E8F0] px-2 py-1 rounded">
<span class="text-alert mr-1">●</span> 50% Vacancy
                        </div>
<button class="text-text-muted hover:text-primary transition-colors">
<span class="material-symbols-outlined text-[20px]">more_horiz</span>
</button>
</div>
</div>
<!-- Table Header (Hidden visually but kept for structure if needed, or we rely on the first one) -->
<div class="grid grid-cols-12 gap-4 px-6 py-2 border-b border-[#E2E8F0] bg-slate-50/50 text-xs font-semibold text-text-muted uppercase tracking-wider md:hidden">
<div class="col-span-12">Details</div>
</div>
<!-- Table Rows -->
<div class="divide-y divide-[#E2E8F0]">
<!-- Row 1: Active -->
<div class="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors group">
<div class="col-span-3 flex items-center gap-4">
<div class="flex flex-col items-center justify-center bg-background-light rounded-lg h-10 w-12 border border-slate-200 shrink-0">
<span class="font-display font-bold text-text-main text-sm">A</span>
</div>
<div class="flex items-center gap-3 min-w-0">
<div class="size-9 rounded-full bg-[#E0F2FE] text-[#0369A1] flex items-center justify-center text-xs font-bold shrink-0">DK</div>
<div class="flex flex-col min-w-0">
<p class="text-sm font-medium text-text-main truncate">David Kim</p>
<p class="text-xs text-text-muted truncate">Active • Long-term</p>
</div>
</div>
</div>
<div class="col-span-2 flex flex-col justify-center">
<span class="inline-flex items-center w-fit px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#D1FAE5] text-[#065F46] mb-1">
                                Active
                            </span>
<span class="text-xs text-text-muted font-medium tabular-nums">Month-to-month</span>
</div>
<div class="col-span-4 flex flex-col justify-center px-4">
<!-- Timeline Component (Month to Month / Infinite feeling) -->
<div class="relative w-full h-8 flex items-center group/timeline cursor-pointer opacity-70">
<div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
<!-- Striped pattern for mtm -->
<div class="h-full w-full bg-[linear-gradient(45deg,#1D3557_25%,transparent_25%,transparent_50%,#1D3557_50%,#1D3557_75%,transparent_75%,transparent)] bg-[length:10px_10px] opacity-20"></div>
</div>
<div class="absolute left-0 top-6 text-[10px] text-text-muted font-medium">Auto-renewing</div>
</div>
</div>
<div class="col-span-2 text-right">
<span class="text-sm font-medium text-text-main tabular-nums">$1,800.00</span>
</div>
<div class="col-span-1 flex justify-end">
<button class="p-1.5 hover:bg-slate-200 rounded-md text-text-muted transition-colors">
<span class="material-symbols-outlined text-[20px]">more_vert</span>
</button>
</div>
</div>
<!-- Row 2: Vacant -->
<div class="grid grid-cols-12 gap-4 px-6 py-4 items-center bg-slate-50/50 hover:bg-slate-100 transition-colors group">
<div class="col-span-3 flex items-center gap-4">
<div class="flex flex-col items-center justify-center bg-white rounded-lg h-10 w-12 border border-slate-200 shrink-0">
<span class="font-display font-bold text-text-muted text-sm">B</span>
</div>
<div class="flex items-center gap-3 min-w-0">
<div class="size-9 rounded-full border border-dashed border-slate-300 text-slate-400 flex items-center justify-center shrink-0">
<span class="material-symbols-outlined text-[16px]">person_add</span>
</div>
<div class="flex flex-col min-w-0">
<p class="text-sm font-medium text-text-muted truncate italic">No Tenant</p>
<p class="text-xs text-text-muted truncate">Vacant • 12 days</p>
</div>
</div>
</div>
<div class="col-span-2 flex flex-col justify-center">
<span class="inline-flex items-center w-fit px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#F3F4F6] text-[#4B5563] border border-slate-200 mb-1">
                                Vacant
                            </span>
<span class="text-xs text-text-muted font-medium">Listed for $1,950</span>
</div>
<div class="col-span-4 flex flex-col justify-center px-4">
<!-- Empty Timeline -->
<div class="w-full h-8 flex items-center justify-center border border-dashed border-slate-300 rounded-lg">
<span class="text-[10px] font-medium text-text-muted flex items-center gap-1">
<span class="material-symbols-outlined text-[12px]">add_circle</span>
                                    Add Lease to Start
                                </span>
</div>
</div>
<div class="col-span-2 text-right">
<span class="text-sm font-medium text-text-muted tabular-nums">--</span>
</div>
<div class="col-span-1 flex justify-end">
<button class="text-xs font-medium text-primary hover:text-primary-light hover:underline px-2 py-1">
                                List Unit
                            </button>
</div>
</div>
</div>
</div>
</div>
</main>
</div>
</body></html>

<!-- 04 Notification Center -->
<!DOCTYPE html>

<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Noado - Notification Center</title>
<!-- Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&amp;family=Inter:wght@300;400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<!-- Tailwind CSS -->
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<!-- Theme Config -->
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "primary": "#1D3557", // Deep Navy
                        "primary-light": "#457B9D", // Steel Blue (Accent)
                        "background-light": "#F1FAEE", // Off-white/Mint hint
                        "background-dark": "#111821",
                        "surface": "#FFFFFF",
                        "highlight": "#A8DADC", // Light Cyan
                        "alert": "#E63946", // Overdue/Error
                        "success": "#2A9D8F", // Paid/Positive
                        "kakao": "#FEE500", // KakaoTalk Yellow
                        "kakao-text": "#3C1E1E", // KakaoTalk Brown Text
                    },
                    fontFamily: {
                        "display": ["Space Grotesk", "sans-serif"],
                        "body": ["Inter", "sans-serif"],
                    },
                    borderRadius: {
                        "DEFAULT": "0.5rem",
                        "lg": "0.75rem", // 12px
                        "xl": "1rem",
                        "2xl": "1.5rem",
                        "full": "9999px"
                    },
                    boxShadow: {
                        "soft": "0px 4px 20px rgba(29, 53, 87, 0.08)",
                    }
                },
            },
        }
    </script>
</head>
<body class="bg-background-light dark:bg-background-dark font-body text-[#1D3557] overflow-hidden antialiased">
<div class="flex h-screen w-full">
<!-- 1. Global Navigation (Sidebar) -->
<aside class="flex w-64 flex-col bg-surface border-r border-[#dce0e5] h-full shrink-0 z-20">
<div class="flex flex-col h-full">
<!-- Logo Area -->
<div class="p-6 flex items-center gap-3">
<div class="bg-center bg-no-repeat bg-cover rounded-full h-10 w-10 bg-primary/10 flex items-center justify-center text-primary" data-alt="Noado Logo Abstract">
<span class="material-symbols-outlined text-[24px]">apartment</span>
</div>
<div class="flex flex-col">
<h1 class="text-primary text-lg font-display font-bold leading-none">Noado</h1>
<p class="text-slate-500 text-xs font-normal">Property Manager</p>
</div>
</div>
<!-- Navigation Links -->
<nav class="flex-1 px-4 space-y-1 overflow-y-auto">
<a class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-highlight/20 hover:text-primary transition-colors group" href="#">
<span class="material-symbols-outlined text-[24px]">dashboard</span>
<span class="text-sm font-medium">Dashboard</span>
</a>
<a class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-highlight/20 hover:text-primary transition-colors group" href="#">
<span class="material-symbols-outlined text-[24px]">payments</span>
<span class="text-sm font-medium">Rent Collection</span>
</a>
<a class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-highlight/20 hover:text-primary transition-colors group" href="#">
<span class="material-symbols-outlined text-[24px]">group</span>
<span class="text-sm font-medium">Tenants</span>
</a>
<!-- Active State -->
<a class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/10 text-primary font-medium transition-colors" href="#">
<span class="material-symbols-outlined text-[24px] fill-1">notifications</span>
<span class="text-sm">Notification Center</span>
</a>
<a class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-highlight/20 hover:text-primary transition-colors group" href="#">
<span class="material-symbols-outlined text-[24px]">history_edu</span>
<span class="text-sm font-medium">Transaction Matcher</span>
</a>
</nav>
<!-- User Profile -->
<div class="p-4 border-t border-[#dce0e5]">
<div class="flex items-center gap-3">
<div class="h-10 w-10 rounded-full bg-cover bg-center" data-alt="User profile picture" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuC56zQMrw9T92VZz28lv4D4zghMPnPvJMro6nFhGlr9q4j2rFPIi1z9dfgPVIItyOlc03ws6gessNUMR4fegKYK0jAmdRWM9bUseEdzZemh2z3SV9ywFmYv5P6OMEoc2iwBekB_hpL_LpCOhYB-uKIVmC7KCbEKSLhiWceV-Mn83VuxdRRTBBZGo0QtHilCvLkHHoUeQVZWSzJfYaU8zZIUzEoSB5sHq1QAf_hMu5WYhvIZIbAshyu1i-vrozXXx6f5eL8Ho3Sd2LmV')"></div>
<div class="flex flex-col">
<p class="text-sm font-medium text-primary">Sarah Kim</p>
<p class="text-xs text-slate-500">Portfolio Owner</p>
</div>
</div>
</div>
</div>
</aside>
<!-- Main Content Wrapper -->
<main class="flex-1 flex flex-col h-full overflow-hidden relative">
<!-- Top Header -->
<header class="bg-surface border-b border-[#dce0e5] h-16 shrink-0 px-6 flex items-center justify-between">
<div>
<h1 class="text-2xl font-display font-bold text-primary tracking-tight">Notification Center</h1>
<p class="text-xs text-slate-500">Manage automated KakaoTalk communications</p>
</div>
<div class="flex items-center gap-3">
<button class="flex items-center gap-2 px-4 py-2 bg-surface border border-[#dce0e5] rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm">
<span class="material-symbols-outlined text-[18px]">settings</span>
                        Settings
                    </button>
</div>
</header>
<!-- 3-Column Layout Container -->
<div class="flex flex-1 overflow-hidden">
<!-- COLUMN 1: Internal Sidebar (Templates) -->
<div class="w-64 bg-surface border-r border-[#dce0e5] flex flex-col h-full overflow-y-auto shrink-0">
<div class="p-4">
<div class="flex items-center justify-between mb-4">
<h2 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Templates</h2>
<button class="text-primary hover:bg-primary/10 rounded p-1 transition-colors">
<span class="material-symbols-outlined text-[18px]">add</span>
</button>
</div>
<div class="space-y-1">
<!-- Active Template Item -->
<button class="w-full flex flex-col items-start p-3 bg-primary/5 border border-primary/20 rounded-lg text-left group transition-all">
<div class="flex w-full justify-between items-center mb-1">
<span class="text-sm font-medium text-primary">Rent Due Reminder</span>
<span class="h-2 w-2 rounded-full bg-success"></span>
</div>
<p class="text-xs text-slate-500 line-clamp-1">Sent 3 days before due date</p>
</button>
<!-- Inactive Template Item -->
<button class="w-full flex flex-col items-start p-3 hover:bg-slate-50 rounded-lg text-left group transition-colors border border-transparent">
<div class="flex w-full justify-between items-center mb-1">
<span class="text-sm font-medium text-slate-700">Overdue Alert</span>
<span class="h-2 w-2 rounded-full bg-success"></span>
</div>
<p class="text-xs text-slate-500 line-clamp-1">Sent 1 day after due date</p>
</button>
<button class="w-full flex flex-col items-start p-3 hover:bg-slate-50 rounded-lg text-left group transition-colors border border-transparent">
<div class="flex w-full justify-between items-center mb-1">
<span class="text-sm font-medium text-slate-700">Lease Renewal</span>
<span class="h-2 w-2 rounded-full bg-slate-300"></span>
</div>
<p class="text-xs text-slate-500 line-clamp-1">Sent 60 days before end</p>
</button>
<button class="w-full flex flex-col items-start p-3 hover:bg-slate-50 rounded-lg text-left group transition-colors border border-transparent">
<div class="flex w-full justify-between items-center mb-1">
<span class="text-sm font-medium text-slate-700">Welcome Message</span>
<span class="h-2 w-2 rounded-full bg-success"></span>
</div>
<p class="text-xs text-slate-500 line-clamp-1">Sent on move-in day</p>
</button>
</div>
</div>
</div>
<!-- COLUMN 2: Editor (Center) -->
<div class="flex-1 bg-background-light overflow-y-auto p-6 flex flex-col gap-6 min-w-[400px]">
<!-- Editor Card -->
<div class="bg-surface rounded-lg shadow-soft border border-[#dce0e5] p-6">
<div class="flex justify-between items-start mb-6">
<div>
<h2 class="text-xl font-display font-bold text-primary mb-1">Rent Due Reminder</h2>
<p class="text-sm text-slate-500">Edit the message sent to tenants before their payment is due.</p>
</div>
<div class="flex items-center gap-3">
<span class="text-sm font-medium text-slate-600">Active</span>
<button class="relative inline-flex h-6 w-11 items-center rounded-full bg-success transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
<span class="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6"></span>
</button>
</div>
</div>
<!-- Variable Chips -->
<div class="mb-4">
<p class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Insert Variable</p>
<div class="flex flex-wrap gap-2">
<button class="px-2 py-1 bg-highlight/20 text-primary-light text-xs font-medium rounded border border-highlight/30 hover:bg-highlight/30 transition-colors">+ {{tenant_name}}</button>
<button class="px-2 py-1 bg-highlight/20 text-primary-light text-xs font-medium rounded border border-highlight/30 hover:bg-highlight/30 transition-colors">+ {{amount_due}}</button>
<button class="px-2 py-1 bg-highlight/20 text-primary-light text-xs font-medium rounded border border-highlight/30 hover:bg-highlight/30 transition-colors">+ {{due_date}}</button>
<button class="px-2 py-1 bg-highlight/20 text-primary-light text-xs font-medium rounded border border-highlight/30 hover:bg-highlight/30 transition-colors">+ {{unit_number}}</button>
<button class="px-2 py-1 bg-highlight/20 text-primary-light text-xs font-medium rounded border border-highlight/30 hover:bg-highlight/30 transition-colors">+ {{bank_account}}</button>
</div>
</div>
<!-- Text Area -->
<div class="relative group">
<textarea class="w-full h-48 p-4 rounded-lg border border-[#dce0e5] text-sm text-primary font-body leading-relaxed resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-slate-50" spellcheck="false">Hello {{tenant_name}},

This is a friendly reminder that your rent payment of {{amount_due}} for unit {{unit_number}} is due on {{due_date}}.

Please send payment to our Shinhan Bank account: {{bank_account}}.

Thank you for being a great tenant!
Noado Management</textarea>
<div class="absolute bottom-3 right-3 text-xs text-slate-400">186 characters</div>
</div>
<div class="mt-4 flex justify-end gap-3">
<button class="px-4 py-2 text-slate-600 hover:text-primary text-sm font-medium transition-colors">Discard Changes</button>
<button class="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg shadow-sm hover:bg-primary/90 transition-colors">Save Template</button>
</div>
</div>
<!-- Automation Rules -->
<div class="bg-surface rounded-lg shadow-soft border border-[#dce0e5] p-6">
<h3 class="text-lg font-display font-semibold text-primary mb-4">Automation Rules</h3>
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
<div>
<label class="block text-sm font-medium text-slate-700 mb-1">Trigger Event</label>
<select class="w-full rounded-lg border border-[#dce0e5] bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:ring-primary/20">
<option>Before Due Date</option>
<option>After Due Date</option>
<option>On Due Date</option>
</select>
</div>
<div class="flex gap-4">
<div class="flex-1">
<label class="block text-sm font-medium text-slate-700 mb-1">Days</label>
<input class="w-full rounded-lg border border-[#dce0e5] px-3 py-2 text-sm text-slate-700 focus:border-primary focus:ring-primary/20" type="number" value="3"/>
</div>
<div class="flex-1">
<label class="block text-sm font-medium text-slate-700 mb-1">Time (KST)</label>
<input class="w-full rounded-lg border border-[#dce0e5] px-3 py-2 text-sm text-slate-700 focus:border-primary focus:ring-primary/20" type="time" value="09:00"/>
</div>
</div>
</div>
<div class="mt-4 p-3 bg-highlight/10 rounded-lg flex items-start gap-3">
<span class="material-symbols-outlined text-primary-light mt-0.5 text-[20px]">info</span>
<p class="text-sm text-slate-600">Messages will be automatically sent to <strong>14 tenants</strong> based on their specific contract due dates.</p>
</div>
</div>
</div>
<!-- COLUMN 3: Preview & Log (Right) -->
<div class="w-[360px] bg-surface border-l border-[#dce0e5] flex flex-col h-full shrink-0">
<!-- Tab Switcher (Mobile/Small Desktop Consideration, though fixed here for desktop) -->
<div class="flex border-b border-[#dce0e5]">
<button class="flex-1 py-3 text-sm font-medium text-primary border-b-2 border-primary">Preview</button>
<button class="flex-1 py-3 text-sm font-medium text-slate-500 hover:text-slate-700">History Log</button>
</div>
<div class="flex-1 overflow-y-auto p-6 bg-slate-50/50">
<!-- Phone Mockup -->
<div class="mx-auto w-[280px] bg-white rounded-[2.5rem] border-[8px] border-slate-800 shadow-xl overflow-hidden relative mb-8">
<!-- Notch/Header -->
<div class="bg-slate-100 h-6 flex justify-center items-center border-b border-slate-200">
<div class="w-16 h-3 bg-slate-300 rounded-full"></div>
</div>
<!-- Kakao Header -->
<div class="bg-[#383333] px-4 py-3 flex items-center justify-between text-white">
<span class="material-symbols-outlined text-[18px]">arrow_back</span>
<span class="text-sm font-medium">Noado Manager</span>
<span class="material-symbols-outlined text-[18px]">search</span>
</div>
<!-- Chat Area -->
<div class="bg-[#bacee0] h-[380px] p-4 flex flex-col gap-3 overflow-y-auto">
<div class="text-center text-[10px] text-slate-500 bg-black/5 rounded-full px-2 py-0.5 self-center mb-2">Today</div>
<!-- Message Bubble -->
<div class="flex gap-2 items-end">
<div class="h-8 w-8 rounded-[12px] bg-primary flex items-center justify-center text-white shrink-0">
<span class="material-symbols-outlined text-[16px]">apartment</span>
</div>
<div class="flex flex-col gap-1 max-w-[80%]">
<div class="text-[10px] text-slate-600 ml-1">Noado</div>
<div class="bg-white rounded-[12px] rounded-tl-none p-2 shadow-sm relative">
<div class="bg-kakao rounded-lg p-3 mb-1">
<p class="text-[11px] font-bold text-kakao-text leading-tight mb-1">RENT DUE REMINDER</p>
<div class="h-[1px] bg-black/10 w-full mb-2"></div>
<p class="text-[12px] text-kakao-text leading-relaxed">
                                                    Hello <strong>Kim Min-su</strong>,<br/><br/>
                                                    This is a friendly reminder that your rent payment of <strong>₩500,000</strong> for unit <strong>401</strong> is due on <strong>Oct 25</strong>.<br/><br/>
                                                    Please send payment to our Shinhan Bank account: 110-345-998877.
                                                </p>
</div>
<div class="flex justify-center mt-2">
<button class="w-full py-1.5 bg-slate-100 rounded text-[11px] text-slate-700 font-medium hover:bg-slate-200">View Contract</button>
</div>
</div>
</div>
<span class="text-[9px] text-slate-500 mb-1">09:00</span>
</div>
</div>
</div>
<!-- Recent Activity Log (Below phone for context) -->
<div class="mb-4">
<h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Recent Activity</h4>
<div class="relative pl-4 border-l-2 border-slate-200 space-y-6">
<!-- Log Item 1 -->
<div class="relative">
<div class="absolute -left-[21px] top-0.5 h-3 w-3 rounded-full bg-success border-2 border-white"></div>
<div class="flex flex-col">
<div class="flex justify-between items-center">
<p class="text-sm font-medium text-slate-700">Unit 304 (Lee)</p>
<span class="text-[10px] text-slate-400">10m ago</span>
</div>
<div class="flex items-center gap-1 mt-0.5">
<span class="material-symbols-outlined text-success text-[14px]">check_circle</span>
<span class="text-xs text-slate-500">Sent &amp; Delivered</span>
</div>
</div>
</div>
<!-- Log Item 2 -->
<div class="relative">
<div class="absolute -left-[21px] top-0.5 h-3 w-3 rounded-full bg-success border-2 border-white"></div>
<div class="flex flex-col">
<div class="flex justify-between items-center">
<p class="text-sm font-medium text-slate-700">Unit 102 (Park)</p>
<span class="text-[10px] text-slate-400">1h ago</span>
</div>
<div class="flex items-center gap-1 mt-0.5">
<span class="material-symbols-outlined text-primary text-[14px]">done_all</span>
<span class="text-xs text-slate-500">Read by user</span>
</div>
</div>
</div>
<!-- Log Item 3 -->
<div class="relative">
<div class="absolute -left-[21px] top-0.5 h-3 w-3 rounded-full bg-alert border-2 border-white"></div>
<div class="flex flex-col">
<div class="flex justify-between items-center">
<p class="text-sm font-medium text-slate-700">Unit 501 (Choi)</p>
<span class="text-[10px] text-slate-400">3h ago</span>
</div>
<div class="flex items-center gap-1 mt-0.5">
<span class="material-symbols-outlined text-alert text-[14px]">error</span>
<span class="text-xs text-alert">Failed: Invalid Number</span>
</div>
</div>
</div>
</div>
</div>
</div>
<!-- Footer Actions -->
<div class="p-4 border-t border-[#dce0e5] bg-surface">
<button class="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-[#dce0e5] rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors">
<span class="material-symbols-outlined text-[18px]">send</span>
                            Send Test to Myself
                        </button>
</div>
</div>
</div>
</main>
</div>
</body></html>

<!-- 05 Transaction Matcher -->
<!DOCTYPE html>

<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Transaction Matcher - Noado</title>
<!-- Fonts -->
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&amp;family=Inter:wght@300;400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<!-- Tailwind CSS -->
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<!-- Tailwind Config -->
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "primary": "#164e9c",
                        "primary-hover": "#113b7a",
                        "primary-light": "#e8f0fe",
                        "background-light": "#f6f7f8",
                        "background-dark": "#111821",
                        "surface": "#ffffff",
                        "accent": "#457B9D",
                        "highlight": "#A8DADC",
                        "alert": "#E63946",
                        "success": "#2A9D8F",
                        "text-main": "#1D3557",
                        "text-muted": "#6D7D8B",
                        "border-subtle": "#E2E8F0"
                    },
                    fontFamily: {
                        "display": ["Space Grotesk", "sans-serif"],
                        "body": ["Inter", "sans-serif"]
                    },
                    borderRadius: {
                        "DEFAULT": "0.5rem",
                        "lg": "1rem",
                        "xl": "1.5rem",
                        "2xl": "2rem",
                        "full": "9999px"
                    },
                    boxShadow: {
                        'soft': '0px 4px 20px rgba(29, 53, 87, 0.08)',
                        'modal': '0px 25px 50px -12px rgba(0, 0, 0, 0.25)'
                    }
                },
            },
        }
    </script>
<style>
        body {
            font-family: 'Inter', sans-serif;
        }
        h1, h2, h3, h4, h5, h6 {
            font-family: 'Space Grotesk', sans-serif;
        }
        
        /* Custom scrollbar for suggested matches list */
        .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
        }
    </style>
</head>
<body class="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center p-4">
<!-- Modal Backdrop -->
<div aria-hidden="true" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity"></div>
<!-- Modal Content -->
<div class="relative w-full max-w-5xl bg-surface rounded-xl shadow-modal z-50 overflow-hidden flex flex-col max-h-[90vh]">
<!-- Modal Header -->
<div class="flex items-center justify-between px-8 py-6 border-b border-border-subtle bg-white sticky top-0 z-10">
<div>
<h2 class="text-text-main text-2xl font-bold tracking-tight flex items-center gap-3">
<span class="material-symbols-outlined text-alert text-3xl">warning</span>
                    Resolve Transaction
                </h2>
<p class="text-text-muted text-sm mt-1">We couldn't automatically link this deposit. Please select the correct tenant to reconcile.</p>
</div>
<button class="text-text-muted hover:text-text-main transition-colors p-2 rounded-full hover:bg-slate-100">
<span class="material-symbols-outlined">close</span>
</button>
</div>
<!-- Modal Body -->
<div class="flex flex-col lg:flex-row flex-1 overflow-hidden bg-background-light">
<!-- LEFT COLUMN: The Problem (Bank Record) -->
<div class="w-full lg:w-5/12 p-8 flex flex-col gap-6 border-r border-border-subtle bg-white relative overflow-y-auto">
<div class="flex items-center justify-between">
<h3 class="text-text-muted uppercase text-xs font-semibold tracking-wider">Bank Record</h3>
<span class="bg-alert/10 text-alert text-xs font-medium px-2.5 py-1 rounded-full border border-alert/20">Unmatched</span>
</div>
<!-- Main Amount Display -->
<div class="flex flex-col items-center justify-center py-8 bg-background-light rounded-xl border border-dashed border-border-subtle">
<span class="text-text-muted text-sm font-medium mb-1">Amount Received</span>
<span class="text-text-main text-4xl font-bold font-display tracking-tight">$850.00</span>
<div class="mt-4 flex items-center gap-2 text-text-muted text-sm">
<span class="material-symbols-outlined text-[18px]">calendar_today</span>
<span>Oct 12, 2023 • 09:42 AM</span>
</div>
</div>
<!-- Details Grid -->
<div class="space-y-4">
<div class="group p-4 rounded-lg border border-border-subtle hover:border-accent/30 transition-all bg-white shadow-sm">
<div class="flex items-start gap-3">
<div class="p-2 bg-blue-50 text-primary rounded-lg">
<span class="material-symbols-outlined">account_balance</span>
</div>
<div>
<p class="text-text-muted text-xs font-medium uppercase tracking-wide">Sender Name</p>
<p class="text-text-main font-semibold text-lg font-display">KIM MIN-SU TRANSFER</p>
<p class="text-text-muted text-xs mt-1">Ref: 20231012-TRF-99281</p>
</div>
</div>
</div>
<div class="p-4 rounded-lg border border-border-subtle bg-slate-50">
<div class="flex items-start gap-3">
<span class="material-symbols-outlined text-text-muted">info</span>
<p class="text-sm text-text-muted leading-relaxed">
                                System Note: The name "KIM MIN-SU" appears in 2 active lease agreements. Auto-match was paused to prevent errors.
                            </p>
</div>
</div>
</div>
<div class="mt-auto pt-6">
<button class="w-full flex items-center justify-center gap-2 text-text-muted hover:text-alert text-sm font-medium transition-colors py-2">
<span class="material-symbols-outlined text-[18px]">block</span>
                        Ignore Transaction
                    </button>
</div>
</div>
<!-- RIGHT COLUMN: The Solution (Suggestions) -->
<div class="w-full lg:w-7/12 p-8 flex flex-col bg-background-light overflow-hidden h-full">
<div class="flex items-center justify-between mb-4">
<h3 class="text-text-muted uppercase text-xs font-semibold tracking-wider">Suggested Matches</h3>
<div class="flex items-center gap-2 text-primary text-sm font-medium cursor-pointer hover:underline">
<span class="material-symbols-outlined text-[18px]">search</span>
                        Advanced Search
                    </div>
</div>
<!-- Search Filter -->
<div class="relative mb-6">
<span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted material-symbols-outlined">search</span>
<input class="w-full pl-10 pr-4 py-3 bg-white border border-border-subtle rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm font-body" placeholder="Search tenant name or unit number..." type="text"/>
</div>
<!-- Suggestions List -->
<div class="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
<!-- Suggestion 1: High Confidence -->
<label class="relative flex items-center p-4 bg-white border-2 border-primary rounded-xl cursor-pointer shadow-soft group transition-all">
<input checked="" class="peer sr-only" name="tenant-match" type="radio"/>
<div class="absolute top-3 right-3 flex items-center gap-1 bg-success/10 text-success text-xs font-bold px-2 py-1 rounded-full">
<span class="material-symbols-outlined text-[14px]">auto_awesome</span>
                            98% Match
                        </div>
<!-- Radio Indicator -->
<div class="h-5 w-5 rounded-full border border-border-subtle mr-4 flex items-center justify-center peer-checked:border-primary peer-checked:bg-primary transition-colors">
<div class="h-2 w-2 rounded-full bg-white opacity-0 peer-checked:opacity-100"></div>
</div>
<!-- Content -->
<div class="flex-1 flex items-center gap-4">
<div class="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">KM</div>
<div class="flex-1">
<div class="flex items-center gap-2">
<h4 class="text-text-main font-bold text-base">Kim Min-su</h4>
<span class="bg-slate-100 text-text-muted text-xs font-medium px-1.5 py-0.5 rounded">Unit 301</span>
</div>
<div class="flex items-center gap-4 mt-1 text-sm">
<span class="text-text-muted">Rent Due: <span class="font-medium text-text-main">$850.00</span></span>
<span class="text-xs text-alert font-medium bg-alert/5 px-1.5 rounded">Overdue 2 days</span>
</div>
</div>
</div>
<!-- Match Highlight -->
<div class="hidden group-hover:flex peer-checked:flex flex-col items-end justify-center text-right pl-4 border-l border-border-subtle ml-4">
<span class="text-xs text-text-muted mb-0.5">Matches</span>
<div class="flex gap-1">
<span class="text-xs bg-success/10 text-success px-1.5 py-0.5 rounded font-medium">Name</span>
<span class="text-xs bg-success/10 text-success px-1.5 py-0.5 rounded font-medium">Amount</span>
</div>
</div>
</label>
<!-- Suggestion 2: Medium Confidence -->
<label class="relative flex items-center p-4 bg-white border border-border-subtle rounded-xl cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group">
<input class="peer sr-only" name="tenant-match" type="radio"/>
<div class="absolute top-3 right-3 flex items-center gap-1 bg-yellow-50 text-yellow-700 text-xs font-bold px-2 py-1 rounded-full border border-yellow-100">
                            60% Match
                        </div>
<div class="h-5 w-5 rounded-full border border-border-subtle mr-4 flex items-center justify-center peer-checked:border-primary peer-checked:bg-primary transition-colors">
<div class="h-2 w-2 rounded-full bg-white opacity-0 peer-checked:opacity-100"></div>
</div>
<div class="flex-1 flex items-center gap-4">
<div class="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 font-bold text-sm">KJ</div>
<div class="flex-1">
<div class="flex items-center gap-2">
<h4 class="text-text-main font-bold text-base">Kim Min-ji</h4>
<span class="bg-slate-100 text-text-muted text-xs font-medium px-1.5 py-0.5 rounded">Unit 402</span>
</div>
<div class="flex items-center gap-4 mt-1 text-sm">
<span class="text-text-muted">Rent Due: <span class="font-medium text-text-main">$850.00</span></span>
<span class="text-xs text-text-muted">Due in 5 days</span>
</div>
</div>
</div>
<div class="hidden group-hover:flex peer-checked:flex flex-col items-end justify-center text-right pl-4 border-l border-border-subtle ml-4">
<span class="text-xs text-text-muted mb-0.5">Matches</span>
<div class="flex gap-1">
<span class="text-xs bg-success/10 text-success px-1.5 py-0.5 rounded font-medium">Amount</span>
</div>
</div>
</label>
<!-- Suggestion 3: Low Confidence -->
<label class="relative flex items-center p-4 bg-white border border-border-subtle rounded-xl cursor-pointer hover:border-primary/50 hover:shadow-md transition-all opacity-75 hover:opacity-100">
<input class="peer sr-only" name="tenant-match" type="radio"/>
<div class="h-5 w-5 rounded-full border border-border-subtle mr-4 flex items-center justify-center peer-checked:border-primary peer-checked:bg-primary transition-colors">
<div class="h-2 w-2 rounded-full bg-white opacity-0 peer-checked:opacity-100"></div>
</div>
<div class="flex-1 flex items-center gap-4">
<div class="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 font-bold text-sm">LS</div>
<div class="flex-1">
<div class="flex items-center gap-2">
<h4 class="text-text-main font-bold text-base">Lee Su-jin</h4>
<span class="bg-slate-100 text-text-muted text-xs font-medium px-1.5 py-0.5 rounded">Unit 105</span>
</div>
<div class="flex items-center gap-4 mt-1 text-sm">
<span class="text-text-muted">Rent Due: <span class="font-medium text-text-main">$900.00</span></span>
<span class="text-xs text-text-muted">Paid Partial</span>
</div>
</div>
</div>
</label>
<!-- Create New Option -->
<button class="w-full flex items-center justify-center p-4 border border-dashed border-border-subtle rounded-xl text-text-muted hover:text-primary hover:border-primary hover:bg-primary/5 transition-all group">
<span class="material-symbols-outlined mr-2 group-hover:scale-110 transition-transform">add_circle</span>
<span class="font-medium">Create New Tenant Record</span>
</button>
</div>
<!-- Helper Text for Keyboard -->
<div class="mt-4 flex items-center justify-center gap-4 text-xs text-text-muted">
<span class="flex items-center gap-1"><kbd class="px-1.5 py-0.5 rounded border border-border-subtle bg-slate-50 font-sans">↑</kbd> <kbd class="px-1.5 py-0.5 rounded border border-border-subtle bg-slate-50 font-sans">↓</kbd> to navigate</span>
<span class="flex items-center gap-1"><kbd class="px-1.5 py-0.5 rounded border border-border-subtle bg-slate-50 font-sans">Enter</kbd> to select</span>
</div>
</div>
</div>
<!-- Modal Footer -->
<div class="px-8 py-5 bg-white border-t border-border-subtle flex items-center justify-between shrink-0">
<button class="px-6 py-2.5 rounded-lg text-text-muted font-medium hover:bg-slate-100 transition-colors">
                Cancel
            </button>
<div class="flex items-center gap-3">
<div class="flex flex-col items-end mr-2 hidden sm:flex">
<span class="text-xs text-text-muted">Linking to:</span>
<span class="text-sm font-bold text-text-main">Kim Min-su (Unit 301)</span>
</div>
<button class="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
<span class="material-symbols-outlined text-[20px]">link</span>
                    Confirm Match
                </button>
</div>
</div>
</div>
</body></html>