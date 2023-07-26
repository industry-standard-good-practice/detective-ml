const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3001/' : '/';

export const API_ROUTES = {
  getExample: `${baseUrl}api/getExample`
}