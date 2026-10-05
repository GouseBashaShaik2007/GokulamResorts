// Where the API lives. Set NEXT_PUBLIC_API_URL in the deployment; the fallback
// is the API started locally with `npm run dev` in backend/.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
