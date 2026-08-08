export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Search: { query?: string } | undefined;
  Library: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Tabs: { screen?: keyof MainTabParamList } | undefined;
  Player: { soundId: string };
  PlaylistDetail: { playlistId: string };
  PlaylistsList: undefined;
  FavouritesList: undefined;
  DownloadsList: undefined;
  LibraryMixes: undefined;
  CategoryDetail: { categoryId: string; name: string };
  CategoriesAll: undefined;
  TrendingAll: undefined;
  Premium: undefined;
  Creator: undefined;
  CreatorProfile: { creatorId: string };
  PaymentCheckout: { planId: string };
  MyPayments: undefined;
  AdminPayments: undefined;
  AdminHub: undefined;
  MixStudio: { mixId?: string; seedSoundId?: string } | undefined;
  SleepTime: undefined;
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
