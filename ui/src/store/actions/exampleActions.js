import { api } from '../../api/api';
import { setError } from './errorActions';
import { get } from 'lodash';

export const FETCHING_EXAMPLE_REQUEST = 'FETCHING_EXAMPLE_REQUEST';
export const FETCHING_EXAMPLE_SUCCESS = 'FETCHING_EXAMPLE_SUCCESS';
export const FETCHING_EXAMPLE_FAILURE = 'FETCHING_EXAMPLE_FAILURE';

export const fetchExample = exampleId => (dispatch, getStore) => {
  console.log('BEFORE BEFORE')

  dispatch({ type: FETCHING_EXAMPLE_REQUEST });

  console.log('BEFORE')

  return api
    .getExample(exampleId)
    .then(response => {
      console.log('HERE')
      dispatch({
        type: FETCHING_EXAMPLE_SUCCESS,
        payload: response.data
      });
    })
    .catch(error => {
      console.log('failure', error)
      dispatch({ type: FETCHING_EXAMPLE_FAILURE });
      dispatch(setError(get(error, 'response', 'Error during data load')));
    })
}
