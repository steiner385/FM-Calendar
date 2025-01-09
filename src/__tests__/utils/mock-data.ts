export function createMockCalendarData(data: {
  id?: string;
  userId: string;
  familyId: string;
  googleCalendarId?: string;
  accessToken?: string;
  refreshToken?: string;
}) {
  return {
    id: data.id || `calendar-${Date.now()}`,
    type: 'GOOGLE',
    name: 'Test Calendar',
    description: 'Test Description',
    googleCalendarId: data.googleCalendarId || `google-calendar-${Date.now()}`,
    accessToken: data.accessToken || 'test-access-token',
    refreshToken: data.refreshToken || 'test-refresh-token',
    familyId: data.familyId,
    timezone: 'UTC',
    family: {
      members: [{ id: data.userId }]
    }
  };
}
