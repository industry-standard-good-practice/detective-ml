export const RESET_ERROR = 'RESET_ERROR';
export const SET_ERROR = 'SET_ERROR';

//TODO: This needs to be built out more

export const setError = (response, onClose, modalTitle) => {
  const message = `Error: ${response}`;

  return dispatch => {
    dispatch({
      type: SET_ERROR,
      payload: { message }
    })
  }
}