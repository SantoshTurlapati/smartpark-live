package com.smartpark.config;

import com.smartpark.security.JwtAuthenticationFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
  private final JwtAuthenticationFilter jwtFilter;
  private final String[] corsOrigins;

  public SecurityConfig(JwtAuthenticationFilter jwtFilter,
                        @Value("${app.cors.origins}") String corsOrigins) {
    this.jwtFilter=jwtFilter;
    this.corsOrigins=corsOrigins.split(",");
  }

  @Bean
  SecurityFilterChain security(HttpSecurity http) throws Exception {
    http.csrf(csrf->csrf.disable())
      .cors(Customizer.withDefaults())
      .sessionManagement(sm->sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .authorizeHttpRequests(auth->auth
        .requestMatchers("/api/auth/**","/api/locations","/api/locations/**","/api/health").permitAll()
        .requestMatchers(HttpMethod.OPTIONS,"/**").permitAll()
        .anyRequest().authenticated())
      .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
    return http.build();
  }

  @Bean
  PasswordEncoder passwordEncoder(){return new BCryptPasswordEncoder();}

  @Bean
  CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config=new CorsConfiguration();
    config.setAllowedOrigins(Arrays.stream(corsOrigins).map(String::trim).toList());
    config.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
    config.setAllowedHeaders(List.of("*"));
    config.setAllowCredentials(true);
    UrlBasedCorsConfigurationSource source=new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**",config);
    return source;
  }
}
