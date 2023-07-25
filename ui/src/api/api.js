import axios from 'axios';
import { API_ROUTES } from './apiRoutes';

export const api = {
  getExample: (exampleId) => {
    return axios.get(`${API_ROUTES.getExample}/${exampleId}`)
  }
}