import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock Supabase Auth
  http.post('*/auth/v1/token', () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      user: { id: 'mock-user-id', email: 'mock@example.com' },
    });
  }),
  
  http.get('*/auth/v1/user', () => {
    return HttpResponse.json({
      id: 'mock-user-id',
      email: 'mock@example.com',
    });
  }),

  // Mock Supabase PostgREST
  http.get('*/rest/v1/*', () => {
    return HttpResponse.json([
      { id: 1, name: 'Mock Data' }
    ]);
  }),

  http.post('*/rest/v1/*', () => {
    return HttpResponse.json({ success: true }, { status: 201 });
  }),

  http.patch('*/rest/v1/*', () => {
    return HttpResponse.json({ success: true }, { status: 200 });
  }),

  http.delete('*/rest/v1/*', () => {
    return HttpResponse.json(null, { status: 204 });
  }),
];
