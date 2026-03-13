<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Str;
use Tests\TestCase;

class AccountControllerTest extends TestCase
{
    use RefreshDatabase;

    private function createUser(array $overrides = []): User
    {
        return User::query()->create(array_merge([
            'first_name' => 'Jane',
            'last_name' => 'Doe',
            'email' => 'jane-' . Str::random(6) . '@example.com',
            'password' => Hash::make('Password123!'),
            'is_global_superadmin' => false,
        ], $overrides));
    }

    // -------------------------------------------------------------------------
    // login — last_login_at
    // -------------------------------------------------------------------------

    public function test_login_records_last_login_at(): void
    {
        $user = $this->createUser(['email' => 'login-test@example.com']);

        $this->assertNull($user->last_login_at);

        $this->postJson('/api/auth/login', [
            'email' => 'login-test@example.com',
            'password' => 'Password123!',
        ])->assertOk();

        $this->assertNotNull($user->fresh()->last_login_at);
    }

    // -------------------------------------------------------------------------
    // updateProfile
    // -------------------------------------------------------------------------

    public function test_update_profile_succeeds(): void
    {
        $user = $this->createUser();

        $response = $this->actingAs($user)->putJson('/api/auth/profile', [
            'first_name' => 'Updated',
            'last_name' => 'Name',
            'email' => 'updated@example.com',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.first_name', 'Updated')
            ->assertJsonPath('user.last_name', 'Name')
            ->assertJsonPath('user.email', 'updated@example.com');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'first_name' => 'Updated',
            'email' => 'updated@example.com',
        ]);
    }

    public function test_update_profile_rejects_duplicate_email(): void
    {
        $existing = $this->createUser(['email' => 'taken@example.com']);
        $user = $this->createUser();

        $this->actingAs($user)->putJson('/api/auth/profile', [
            'first_name' => 'Jane',
            'last_name' => 'Doe',
            'email' => 'taken@example.com',
        ])->assertUnprocessable();
    }

    public function test_update_profile_allows_same_email(): void
    {
        $user = $this->createUser(['email' => 'same@example.com']);

        $this->actingAs($user)->putJson('/api/auth/profile', [
            'first_name' => 'Jane',
            'last_name' => 'Updated',
            'email' => 'same@example.com',
        ])->assertOk();
    }

    public function test_update_profile_requires_authentication(): void
    {
        $this->putJson('/api/auth/profile', [
            'first_name' => 'Jane',
            'last_name' => 'Doe',
            'email' => 'x@example.com',
        ])->assertUnauthorized();
    }

    // -------------------------------------------------------------------------
    // changePassword
    // -------------------------------------------------------------------------

    public function test_change_password_succeeds(): void
    {
        $user = $this->createUser();

        $this->actingAs($user)->putJson('/api/auth/password', [
            'current_password' => 'Password123!',
            'new_password' => 'NewPassword456@',
            'new_password_confirmation' => 'NewPassword456@',
        ])->assertOk()->assertJsonPath('message', 'Password updated.');

        $this->assertTrue(Hash::check('NewPassword456@', $user->fresh()->password));
    }

    public function test_change_password_rejects_wrong_current_password(): void
    {
        $user = $this->createUser();

        $this->actingAs($user)->putJson('/api/auth/password', [
            'current_password' => 'WrongPassword!',
            'new_password' => 'NewPassword456@',
            'new_password_confirmation' => 'NewPassword456@',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['current_password']);
    }

    public function test_change_password_rejects_weak_new_password(): void
    {
        $user = $this->createUser();

        $this->actingAs($user)->putJson('/api/auth/password', [
            'current_password' => 'Password123!',
            'new_password' => 'tooshort',
            'new_password_confirmation' => 'tooshort',
        ])->assertUnprocessable();
    }

    public function test_change_password_rejects_mismatched_confirmation(): void
    {
        $user = $this->createUser();

        $this->actingAs($user)->putJson('/api/auth/password', [
            'current_password' => 'Password123!',
            'new_password' => 'NewPassword456@',
            'new_password_confirmation' => 'DifferentPassword456@',
        ])->assertUnprocessable();
    }

    public function test_change_password_requires_authentication(): void
    {
        $this->putJson('/api/auth/password', [
            'current_password' => 'Password123!',
            'new_password' => 'NewPassword456@',
            'new_password_confirmation' => 'NewPassword456@',
        ])->assertUnauthorized();
    }

    // -------------------------------------------------------------------------
    // forgotPassword
    // -------------------------------------------------------------------------

    public function test_forgot_password_always_returns_200_for_existing_email(): void
    {
        $this->createUser(['email' => 'forgot@example.com']);

        $this->postJson('/api/auth/forgot-password', [
            'email' => 'forgot@example.com',
        ])->assertOk();
    }

    public function test_forgot_password_always_returns_200_for_nonexistent_email(): void
    {
        $this->postJson('/api/auth/forgot-password', [
            'email' => 'doesnotexist@example.com',
        ])->assertOk();
    }

    public function test_forgot_password_sends_notification(): void
    {
        Notification::fake();

        $user = $this->createUser(['email' => 'notify@example.com']);

        $this->postJson('/api/auth/forgot-password', [
            'email' => 'notify@example.com',
        ])->assertOk();

        Notification::assertSentTo($user, ResetPassword::class);
    }

    // -------------------------------------------------------------------------
    // resetPasswordViaToken
    // -------------------------------------------------------------------------

    public function test_reset_password_via_valid_token_succeeds(): void
    {
        $user = $this->createUser(['email' => 'reset@example.com']);
        $token = Password::createToken($user);

        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => 'reset@example.com',
            'password' => 'ResetPassword99!',
            'password_confirmation' => 'ResetPassword99!',
        ])->assertOk()->assertJsonPath('message', 'Password has been reset.');

        $this->assertTrue(Hash::check('ResetPassword99!', $user->fresh()->password));
    }

    public function test_reset_password_with_invalid_token_fails(): void
    {
        $this->createUser(['email' => 'badtoken@example.com']);

        $this->postJson('/api/auth/reset-password', [
            'token' => 'invalid-token',
            'email' => 'badtoken@example.com',
            'password' => 'ResetPassword99!',
            'password_confirmation' => 'ResetPassword99!',
        ])->assertUnprocessable();
    }

    public function test_reset_password_with_weak_password_fails(): void
    {
        $user = $this->createUser(['email' => 'weakpw@example.com']);
        $token = Password::createToken($user);

        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => 'weakpw@example.com',
            'password' => 'weak',
            'password_confirmation' => 'weak',
        ])->assertUnprocessable();
    }
}
