import React, { useRef, useCallback } from 'react';
import { StyleSheet, Animated, TouchableWithoutFeedback, View } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { getColors } from '../config/constants';
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

const useStackOptions = () => {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  
  return {
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.primary,
    headerTitleStyle: { fontWeight: '600' as const, fontSize: 17 },
    contentStyle: { backgroundColor: colors.background },
  };
};

// ---------------------------------------------------------------------------
// Profile header button (user avatar on top-right of every tab)
// ---------------------------------------------------------------------------

function ProfileHeaderButton() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const colors = getColors(isDark);

  // Fluid touch animations
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.9,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 6,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  return (
    <TouchableWithoutFeedback
      onPress={() => navigation.navigate('Profile')}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        }}
      >
        <Avatar
          name={user?.full_name ?? '?'}
          color={user?.color ?? colors.blue}
          size="small"
          imageUrl={user?.avatar_url}
        />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

// ---------------------------------------------------------------------------
// Auth stack
// ---------------------------------------------------------------------------

function AuthStack() {
  const defaultStackOptions = useStackOptions();
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
  const defaultStackOptions = useStackOptions();
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
  const defaultStackOptions = useStackOptions();
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
  const defaultStackOptions = useStackOptions();
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
  const defaultStackOptions = useStackOptions();
  return (
    <GroupsStackNav.Navigator screenOptions={defaultStackOptions}>
      <GroupsStackNav.Screen
        name="Groups"
        component={GroupsScreen}
        options={{
          title: 'Groups',
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
  const defaultStackOptions = useStackOptions();
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
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 4,
          height: 88,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
        },
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
        options={{ title: 'Groups' }}
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
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 6,
  },
});
