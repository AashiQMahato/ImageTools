export interface ApiSuccess<T> {
    success: true;
    message?: string;
    data?: T;
}

export interface ApiFailure {
    success: false;
    message: string;
    code?: string;
}
