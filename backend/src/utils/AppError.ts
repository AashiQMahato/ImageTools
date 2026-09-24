export class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;

    constructor(message: string, statusCode = 500, code = "INTERNAL_ERROR") {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.code = code;
    }
}

export class NotImplementedError extends AppError {
    constructor(feature: string) {
        super(`${feature} is not implemented yet.`, 501, "NOT_IMPLEMENTED");
        this.name = "NotImplementedError";
    }
}
