<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Dummy hash used for constant-time comparison when the user does not exist.
     * Prevents timing attacks that would reveal valid email addresses.
     */
    private const DUMMY_HASH = '$2y$12$gkJgVOBMmaLFJ/J4aw8MAe4keMLgAMggH.iiRWxS9qO1JqJxi61Gm';

    public function login(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->where('email', $payload['email'])->first();

        // Always run Hash::check regardless of whether the user exists so that
        // response timing is consistent and cannot reveal valid email addresses.
        $passwordHash = $user?->password ?? self::DUMMY_HASH;
        $valid = Hash::check($payload['password'], $passwordHash);

        if (! $user || ! $valid) {
            throw ValidationException::withMessages(['email' => 'Invalid credentials provided.']);
        }

        $token = $user->createToken('api')->plainTextToken;

        return new JsonResponse([
            'token' => $token,
            'user' => $user->only(['id', 'first_name', 'last_name', 'email', 'is_global_superadmin']),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return new JsonResponse([
            'user' => $request->user()->load('tenantMemberships.tenant'),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return new JsonResponse(['message' => 'Logged out.']);
    }
}
