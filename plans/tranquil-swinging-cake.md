# Add Fourth Quadrant to Blue Strip

## Change
In `src/app/pages/LandingPage.tsx` line 97: change `grid-cols-3` → `grid-cols-4`.
Add fourth object to the array (after the third item):
```ts
{
  icon: <LayoutDashboard className="w-4 h-4" strokeWidth={1.5} />,
  title: 'Create new business case calculator',
  body: 'Build and customize new calculators for any business case – tailored to your needs.',
  accent: '#C8CEED',
},
```

---

# Analysis: Demo vs Project Differences

## Context
User asked what the biggest differences are between the /demo and /project routes in the AI Business Case Tool.

## Findings

### Current Differences (very minimal)

| Area | Demo (`/demo`) | Project (`/project`) |
|------|---------------|----------------------|
| **Nav label** | "AI Business Case Tool — Demo" | "AI Business Case Tool — Project" |
| **URL path** | `/demo`, `/demo/benchmarking`, `/demo/business-case` | `/project`, `/project/benchmarking`, `/project/business-case` |
| **Landing page card** | Blue card, "Start Demo" button | Dark card, "Start Project" button |

### What is identical (everything else)
- **Same components**: Home, Benchmarking, BusinessCasePage — no route-based logic differences
- **Same AppContext**: No demo flag, no pre-loaded mock data for demo mode
- **Same initial state**: Both start with empty `clientData`, `selectedProcesses: ['P2P']`, empty baselines
- **Same data persistence**: Both use localStorage-based snapshot save/restore
- **Same Simulation, AipipPage**: No demo-specific behavior

### Key conclusion
The demo and project are **functionally identical** right now. The only material difference is the cosmetic label in the nav header. There is no pre-loaded sample data, no locked/read-only fields, and no behavioral distinction between the two modes.

## Possible next steps (if user wants to differentiate them)
1. Pre-populate demo mode with sample client data (company name, revenue, FTEs, NAICS code, process selections)
2. Make demo mode read-only or show a "sample data" banner
3. Add a snapshot restore on mount when route is `/demo` that loads hardcoded mock values
