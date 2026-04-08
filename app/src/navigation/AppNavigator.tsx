import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/constants';
import { useAuth } from '../hooks/useAuth';
import { LoadingScreen, Avatar } from '../components/common';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignUpScreen';

// Dashboard
import DashboardScreen from '../screens/dashboard/DashboardScreen';

// Expenses
import ExpensesScreen from '../screens/expenses/ExpensesScreen';
import AddExpenseScreen from '../screens/expenses/AddExpenseScreen';
import BalancesScreen from '../screens/expenses/BalancesScreen';

// Tasks
import TasksScreen from '../screens/tasks/TasksScreen';
import AddTaskScreen from '../screens/tasks/AddTaskScreen';
import TaskDetailScreen from '../screens/tasks/TaskDetailScreen';

// Groups
import GroupsScreen from '../screens/groups/GroupsScreen';
import CreateGroupScreen from '../screens/groups/CreateGroupScreen';
import GroupDetailScreen from '../screens/groups/GroupDetailScreen';

// Notifications
import NotificationsScreen from '../screens/notifications/NotificationsScreen';

// Profile
import ProfileScreen from '../screens/profile/ProfileScreen';

// ---------------------------------------------------------------------------
// Type definitions for navigators
// ---------------------------------------------------------------------------

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type DashboardStackParamList = {
  Dashboard: undefined;
  GroupDetail: { groupId: string };
  Profile: undefined;
};

export type ExpensesStackParamList = {
  Expenses: undefined;
  AddExpense: { groupId?: string } | undefined;
  ExpenseDetail: { expenseId: string };
  Balances: { groupId?: string } | undefined;
  Profile: undefined;
};

export type TasksStackParamList = {
  Tasks: undefined;
  AddTask: { groupId?: string; taskId?: string; editMode?: boolean } | undefined;
  TaskDetail: { taskId: string; groupId?: string };
  Profile: undefined;
};

export type GroupsStackParamList = {
  Groups: undefined;
  CreateGroup: { groupId?: string; editing?: boolean } | undefined;
  GroupDetail: { groupId: string };
  Profile: undefined;
};

export type NotificationsStackParamList = {
  Notifications: undefined;
  Profile: undefined;
};

export type MainTabParamList = {
  DashboardTab: undefined;
  ExpensesTab: undefined;
  TasksTab: undefined;
  GroupsTab: undefined;
  NotificationsTab: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

// ---------------------------------------------------------------------------
// Stack navigators
// ---------------------------------------------------------------------------

const AuthStackNav = createNativeStackNavigator<AuthStackParamList>();
const DashboardStackNav = createNativeStackNavigator<DashboardStackParamList>();
const ExpensesStackNav = createNativeStackNavigator<ExpensesStackParamList>();
const TasksStackNav = createNativeStackNavigator<TasksStackParamList>();
const GroupsStackNav = createNativeStackNavigator<GroupsStackParamList>();
const NotificationsStackNav = createNativeStackNavigator<NotificationsStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

// ---------------------------------------------------------------------------
// Shared stack screen options
// ---------------------------------------------------------------------------

const defaultStackOptions = {
  headerShadowVisible: false,
  headerStyle: { backgroundColor: COLORS.background },
  headerTintColor: COLORS.primary,
  headerTitleStyle: { fontWeight: '600' as const, fontSize: 17 },
  contentStyle: { backgroundColor: COLORS.background },
};

// ---------------------------------------------------------------------------
// Profile header button (user avatar on top-right of every tab)
// ---------------------------------------------------------------------------

function ProfileHeaderButton() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Profile')}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Avatar
        name={user?.full_name ?? '?'}
        color={user?.color ?? COLORS.blue}
        size="small"
        imageUrl={user?.avatar_url}
      />
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Auth stack
// ---------------------------------------------------------------------------

function AuthStack() {
  return (
    <AuthStackNav.Navigator screenOptions={{ ...defaultStackOptions, headerShown: false }}>
      <AuthStackNav.Screen name="Login" component={LoginScreen} />
      <AuthStackNav.Screen name="Signup" component={SignupScreen} />
    </AuthStackNav.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Tab stacks — each has Profile screen + avatar in header
// ---------------------------------------------------------------------------

function DashboardStack() {
  return (
    <DashboardStackNav.Navigator screenOptions={defaultStackOptions}>
      <DashboardStackNav.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <DashboardStackNav.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
        options={{ title: 'Group' }}
      />
      <DashboardStackNav.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile & Settings' }}
      />
    </DashboardStackNav.Navigator>
  );
}

function ExpensesStack() {
  return (
    <ExpensesStackNav.Navigator screenOptions={defaultStackOptions}>
      <ExpensesStackNav.Screen
        name="Expenses"
        component={ExpensesScreen}
        options={{
          title: 'Expenses',
          headerRight: () => <ProfileHeaderButton />,
        }}
      />
      <ExpensesStackNav.Screen
        name="AddExpense"
        component={AddExpenseScreen}
        options={{ title: 'Add Expense', presentation: 'modal' }}
      />
      <ExpensesStackNav.Screen
        name="Balances"
        component={BalancesScreen}
        options={{ title: 'Balances' }}
      />
      <ExpensesStackNav.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile & Settings' }}
      />
    </ExpensesStackNav.Navigator>
  );
}

function TasksStack() {
  return (
    <TasksStackNav.Navigator screenOptions={defaultStackOptions}>
      <TasksStackNav.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          title: 'Tasks',
          headerRight: () => <ProfileHeaderButton />,
        }}
      />
      <TasksStackNav.Screen
        name="AddTask"
        component={AddTaskScreen}
        options={{ title: 'Add Task', presentation: 'modal' }}
      />
      <TasksStackNav.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{ title: 'Task' }}
      />
      <TasksStackNav.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile & Settings' }}
      />
    </TasksStackNav.Navigator>
  );
}

function GroupsStack() {
  return (
    <GroupsStackNav.Navigator screenOptions={defaultStackOptions}>
      <GroupsStackNav.Screen
        name="Groups"
        component={GroupsScreen}
        options={{
          title: 'Roommates',
          headerRight: () => <ProfileHeaderButton />,
        }}
      />
      <GroupsStackNav.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{ title: 'Create Group', presentation: 'modal' }}
      />
      <GroupsStackNav.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
        options={{ title: 'Group' }}
      />
      <GroupsStackNav.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile & Settings' }}
      />
    </GroupsStackNav.Navigator>
  );
}

function NotificationsStack() {
  return (
    <NotificationsStackNav.Navigator screenOptions={defaultStackOptions}>
      <NotificationsStackNav.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
          headerRight: () => <ProfileHeaderButton />,
        }}
      />
      <NotificationsStackNav.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile & Settings' }}
      />
    </NotificationsStackNav.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Main bottom tabs — 5 tabs (no Profile tab)
// ---------------------------------------------------------------------------

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.blue,
        tabBarInactiveTintColor: COLORS.mutedForeground,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'DashboardTab':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'ExpensesTab':
              iconName = focused ? 'receipt' : 'receipt-outline';
              break;
            case 'TasksTab':
              iconName = focused ? 'checkmark-circle' : 'checkmark-circle-outline';
              break;
            case 'GroupsTab':
              iconName = focused ? 'people' : 'people-outline';
              break;
            case 'NotificationsTab':
              iconName = focused ? 'notifications' : 'notifications-outline';
              break;
            default:
              iconName = 'ellipse';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardStack}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="ExpensesTab"
        component={ExpensesStack}
        options={{ title: 'Expenses' }}
      />
      <Tab.Screen
        name="TasksTab"
        component={TasksStack}
        options={{ title: 'Tasks' }}
      />
      <Tab.Screen
        name="GroupsTab"
        component={GroupsStack}
        options={{ title: 'Roommates' }}
      />
      <Tab.Screen
        name="NotificationsTab"
        component={NotificationsStack}
        options={{ title: 'Notifications' }}
      />
    </Tab.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Root navigator
// ---------------------------------------------------------------------------

export default function AppNavigator() {
  const { session, initialized, loading } = useAuth();
  const isAuthenticated = !!session;

  if (!initialized || loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <RootStack.Screen name="Main" component={MainTabs} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthStack} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.background,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    paddingTop: 4,
    height: 88,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 6,
  },
});
