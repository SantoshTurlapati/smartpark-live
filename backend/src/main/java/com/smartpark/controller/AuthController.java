package com.smartpark.controller;

import com.smartpark.dto.AuthDtos.*;
import com.smartpark.model.Role;
import com.smartpark.model.User;
import com.smartpark.repository.UserRepository;
import com.smartpark.security.JwtService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final UserRepository users;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwtService;

  public AuthController(UserRepository users, PasswordEncoder passwordEncoder, JwtService jwtService) {
    this.users=users;
    this.passwordEncoder=passwordEncoder;
    this.jwtService=jwtService;
  }

  @PostMapping("/register")
  public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
    Role role=request.role();
    if (role!=Role.CUSTOMER && role!=Role.OWNER) {
      return ResponseEntity.badRequest().body(new ErrorResponse("Only customer and owner registration is allowed"));
    }
    if (users.existsByEmailIgnoreCase(request.email().trim())) {
      return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse("That email is already registered"));
    }
    User user=new User();
    user.setName(request.name().trim());
    user.setEmail(request.email().trim().toLowerCase());
    user.setPasswordHash(passwordEncoder.encode(request.password()));
    user.setRole(role);
    user.setOwnerVerification(role==Role.OWNER ? "Pending" : "Not Required");
    users.save(user);
    return ResponseEntity.status(HttpStatus.CREATED).body(new ErrorResponse("Account created"));
  }

  @PostMapping("/login")
  public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
    var user=users.findByEmailIgnoreCase(request.email().trim()).orElse(null);
    if (user==null || request.role()==null || user.getRole()!=request.role()
        || !passwordEncoder.matches(request.password(),user.getPasswordHash())) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ErrorResponse("Email, password or account type is incorrect"));
    }
    if (!"Active".equalsIgnoreCase(user.getAccountStatus())) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ErrorResponse("This account is suspended"));
    }
    String token=jwtService.generate(user);
    return ResponseEntity.ok(new AuthResponse(token,user.getId(),user.getName(),user.getEmail(),
      user.getRole().name().toLowerCase(),user.getAccountStatus(),user.getOwnerVerification()));
  }

  @GetMapping("/me")
  public AuthResponse currentUser(@org.springframework.security.core.annotation.AuthenticationPrincipal User user) {
    return new AuthResponse(null,user.getId(),user.getName(),user.getEmail(),
      user.getRole().name().toLowerCase(),user.getAccountStatus(),user.getOwnerVerification());
  }
}
