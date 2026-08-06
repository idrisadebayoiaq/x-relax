export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Search: { query?: string } | undefined;
  Library: undefined;
  Premium: undefined;
  Profile: undefined;
  Creator: undefined;
};

export type RootStackParamList = {
  Tabs: { screen?: keyof MainTabParamList } | undefined;
  Player: { soundId: string };
  PlaylistDetail: { playlistId: string };
  CategoryDetail: { categoryId: string; name: string };
  PaymentCheckout: { planId: string };
  MyPayments: undefined;
  AdminPayments: undefined;
  AdminHub: undefined;
  MixStudio: undefined;
  BecomeCreator: undefined;
  CreatorUpload: undefined;
  CreatorSounds: undefined;
  CreatorVerification: undefined;
  CreatorWithdrawals: undefined;
  AdminModeration: undefined;
  AdminVerifications: undefined;
  AdminWithdrawals: undefined;
  Notifications: undefined;
  Legal: { doc: 'privacy' | 'terms' };
};
