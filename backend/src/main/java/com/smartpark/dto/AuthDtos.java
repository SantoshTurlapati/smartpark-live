package com.smartpark.dto;

import com.smartpark.model.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AuthDtos {
  public record RegisterRequest(
    @NotBlank @Size(min=2,max=80) String name,
    @NotBlank @Email @Size(max=120) String email,
    @NotBlank @Size(min=8,max=128) String password,
    Role role) {}
  public record LoginRequest(
    @NotBlank @Email String email,
    @NotBlank String password,
    Role role) {}
  public record AuthResponse(String token, String id, String name, String email, String role,
                             String accountStatus, String ownerVerification) {}
  public record ErrorResponse(String error) {}
}
