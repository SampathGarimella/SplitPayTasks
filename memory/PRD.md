# Split Pay & Tasks App - PRD

## Original Problem Statement
User requested the following improvements for their React Native/Expo app:
1. Add Apple fluid touch animations to all buttons, bottom bar, and touchable elements
2. Change app background from white to light gray with dark mode support
3. Fix profile button accessibility from home tab
4. Fix profile button fluid touch with consistent round dimensions
5. Implement group rules for expenses/tasks (anyone can add vs owner only)
6. Rename "Roommates" tab to "Groups"
7. Add group type editing (home, trip, office, event, custom)

## Tech Stack
- React Native with Expo SDK 54
- TypeScript
- Supabase (Auth + Database)
- React Navigation

## User Personas
- **Roommates**: Track shared expenses and household chores
- **Trip Groups**: Split travel expenses with friends
- **Office Teams**: Manage shared purchases and tasks
- **Event Organizers**: Split costs for events

## Core Requirements (Static)
- Expense tracking with multiple split types
- Task management with rotation and recurrence
- Group-based organization
- Settlement tracking between members
- Real-time notifications

---

## Implemented Features (Jan 2025)

### 1. Apple Fluid Touch Animations
- Created `FluidTouchable` component with iOS-like scale + opacity animations
- Updated `Button` component with fluid animations
- Updated `Card` component with fluid touch support
- Updated `FAB` (Floating Action Button) with fluid animations
- Profile avatar has fluid touch animation

### 2. Theme System (Light Gray + Dark Mode)
- Created `ThemeProvider` and `useTheme` hook in `/app/app/src/hooks/useTheme.tsx`
- Updated `constants.ts` with `LIGHT_COLORS` and `DARK_COLORS`
- Light mode background: `#f5f5f7` (Apple-like light gray)
- Dark mode background: `#121212` (standard dark gray)
- Dark mode toggle added to Profile Settings under "Appearance" section
- Theme preference persisted using `expo-secure-store`

### 3. Profile Button Accessibility (Home Tab)
- Profile avatar in Dashboard is now fully tappable
- Navigates to Profile screen on tap
- Consistent fluid touch animation

### 4. Profile Photo Fluid Touch
- Profile avatar uses consistent 44x44 dimensions with 22px border radius
- Fluid touch animation with scale (0.9) and opacity effects
- Works identically in Dashboard header and Profile screen

### 5. Group Permissions (Rules)
- Added `expense_permission` column to groups table (`anyone` | `owner_only`)
- Added `task_permission` column to groups table (`anyone` | `owner_only`)
- Permission settings visible in CreateGroupScreen (when editing)
- UI shows two radio options: "Anyone can add" vs "Owner only"

### 6. Tab Rename
- "Roommates" tab renamed to "Groups"
- Updated in AppNavigator for both tab label and stack header

### 7. Group Type System
- Added `group_type` column to groups table
- Default types: Home, Trip, Office, Event, Custom
- Custom type allows user-defined names
- Group type displayed as badge in GroupDetailScreen header
- Editable via "Edit Group Settings" button (admin only)

### 8. Theme-Aware Components Updated
- `Button`, `Card`, `FAB`, `Input`, `EmptyState`, `LoadingScreen`
- `DashboardScreen`, `ProfileScreen`, `GroupDetailScreen`, `CreateGroupScreen`
- All use `useTheme()` hook and `getColors()` for dynamic colors

---

## Database Migrations
- `001_initial_schema.sql` - Base schema
- `002_add_group_type_permissions.sql` - Added group_type, expense_permission, task_permission columns

---

## Backlog / Future Features

### P0 (Critical)
- [ ] Run Supabase migration for new columns

### P1 (High Priority)
- [ ] Enforce permissions in frontend (disable add buttons for non-owners)
- [ ] Show group badge in expense/task list items
- [ ] Add group filter to expense/task lists

### P2 (Nice to Have)
- [ ] Push notifications integration
- [ ] Receipt photo upload
- [ ] Expense analytics dashboard
- [ ] Budget tracking per group

---

## Next Tasks
1. Run the database migration on user's Supabase instance
2. Test dark mode toggle
3. Test group type editing flow
4. Test profile navigation from home tab
