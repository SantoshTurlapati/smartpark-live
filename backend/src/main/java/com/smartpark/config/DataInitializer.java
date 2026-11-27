package com.smartpark.config;

import com.smartpark.model.Role;
import com.smartpark.model.User;
import com.smartpark.repository.UserRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.annotation.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements ApplicationRunner {
  private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

  private final UserRepository users;
  private final PasswordEncoder passwordEncoder;
  private final String adminEmail;
  private final String adminPassword;

  public DataInitializer(UserRepository users, PasswordEncoder passwordEncoder,
                         @Value("${app.admin.email}") String adminEmail,
                         @Value("${app.admin.password}") String adminPassword) {
    this.users=users;
    this.passwordEncoder=passwordEncoder;
    this.adminEmail=adminEmail;
    this.adminPassword=adminPassword;
  }

  @Override
  public void run(ApplicationArguments args) {
    if (adminEmail.isBlank() || adminPassword.isBlank()) {
      log.warn("Administrator seed skipped because ADMIN_EMAIL or ADMIN_PASSWORD is not configured");
      return;
    }
    var existingAdmin=users.findByEmailIgnoreCase(adminEmail);
    if (existingAdmin.isPresent()) {
      User admin=existingAdmin.get();
      if (!passwordEncoder.matches(adminPassword, admin.getPasswordHash())) {
        admin.setPasswordHash(passwordEncoder.encode(adminPassword));
        users.save(admin);
      }
      return;
    }
    User admin=new User();
    admin.setName("Administrator");
    admin.setEmail(adminEmail);
    admin.setPasswordHash(passwordEncoder.encode(adminPassword));
    admin.setRole(Role.ADMIN);
    users.save(admin);
  }
}
