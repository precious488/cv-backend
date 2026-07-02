"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTokens = generateTokens;
exports.verifyRefreshToken = verifyRefreshToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function generateTokens(payload) {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    const accessToken = jsonwebtoken_1.default.sign(payload, accessSecret, {
        expiresIn: (process.env.JWT_ACCESS_EXPIRES ?? '15m'),
    });
    const refreshToken = jsonwebtoken_1.default.sign({ sub: payload.sub }, refreshSecret, {
        expiresIn: (process.env.JWT_REFRESH_EXPIRES ?? '7d'),
    });
    return { accessToken, refreshToken };
}
function verifyRefreshToken(token) {
    const secret = process.env.JWT_REFRESH_SECRET;
    return jsonwebtoken_1.default.verify(token, secret);
}
