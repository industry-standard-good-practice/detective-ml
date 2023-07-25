import {
    FETCHING_EXAMPLE_REQUEST,
    FETCHING_EXAMPLE_SUCCESS,
    FETCHING_EXAMPLE_FAILURE
} from '../actions'

export const initialState = {
    isFetching: false,
    data: {}
}

export const exampleReducer = (state = initialState, action) => {
    switch (action.type) {
        case FETCHING_EXAMPLE_REQUEST:
            return { ...state, isFetching: true, data: {} };
        case FETCHING_EXAMPLE_SUCCESS:
            return { ...state, isFetching: false, data: action.payload };
        case FETCHING_EXAMPLE_FAILURE:
            return { ...state, isFetching: false};
        default:
            return state;
    }
}