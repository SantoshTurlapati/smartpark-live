package com.smartpark.config;

import com.smartpark.model.Role;
import com.smartpark.model.User;
import com.smartpark.repository.UserRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements ApplicationRunner {
  private final UserRepository users;
  private final PasswordEncoder passwordEncoder;

  public DataInitializer(UserRepository users, PasswordEncoder passwordEncoder) {
    this.users=users;
    this.passwordEncoder=passwordEncoder;
  }

  @Override
  public void run(ApplicationArguments args) {
    if (users.existsByEmailIgnoreCase("admin@smartpark.com")) return;
    User admin=new User();
    admin.setName("Administrator");
    admin.setEmail("admin@smartpark.com");
    admin.setPasswordHash(passwordEncoder.encode("admin123"));
    admin.setRole(Role.ADMIN);
    users.save(admin);
  }
}
