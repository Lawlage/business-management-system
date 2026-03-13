<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Dummy hash used for constant-time comparison when the user does not exist.
     * Prevents timing attacks that would reveal valid email addresses.
     */
    private const DUMMY_HASH = '$2y$12$gkJgVOBMmaLFJ/J4aw8MAe4keMLgAMggH.iiRWxS9qO1JqJxi61Gm';

    public function __construct(private readonly AuditLogger $auditLogger)
    {
    }

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

        $user->update(['last_login_at' => now()]);

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

    public function updateProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $payload = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email,' . $user->id],
        ]);

        $user->update($payload);

        $this->auditLogger->global($request, 'auth.profile_updated', $user, null, [
            'entity_type' => 'user',
            'entity_id' => (string) $user->id,
        ]);

        return new JsonResponse([
            'user' => $user->fresh()->load('tenantMemberships.tenant'),
        ]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $request->validate([
            'current_password' => ['required', 'string'],
            'new_password' => [
                'required',
                'string',
                'confirmed',
                'min:12',
                'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/',
            ],
            'new_password_confirmation' => ['required', 'string'],
        ]);

        if (! Hash::check($request->input('current_password'), $user->password)) {
            throw ValidationException::withMessages(['current_password' => 'Current password is incorrect.']);
        }

        $user->update(['password' => Hash::make($request->input('new_password'))]);

        $this->auditLogger->global($request, 'auth.password_changed', $user, null, [
            'entity_type' => 'user',
            'entity_id' => (string) $user->id,
        ]);

        return new JsonResponse(['message' => 'Password updated.']);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
        ]);

        // Always return 200 regardless of whether the email exists to prevent user enumeration.
        Password::sendResetLink($request->only('email'));

        return new JsonResponse(['message' => 'If an account with that email exists, a password reset link has been sent.']);
    }

    public function resetPasswordViaToken(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => [
                'required',
                'string',
                'confirmed',
                'min:12',
                'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/',
            ],
            'password_confirmation' => ['required', 'string'],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password): void {
                $user->forceFill(['password' => Hash::make($password)])->save();
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => __($status)]);
        }

        return new JsonResponse(['message' => 'Password has been reset.']);
    }
}
