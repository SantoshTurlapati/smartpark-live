package com.smartpark.security;

import com.smartpark.model.Role;
import com.smartpark.repository.UserRepository;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
  private final JwtService jwtService;
  private final UserRepository users;

  public JwtAuthenticationFilter(JwtService jwtService, UserRepository users) {
    this.jwtService=jwtService;
    this.users=users;
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                  FilterChain filterChain) throws ServletException, IOException {
    String header=request.getHeader("Authorization");
    if (header!=null && header.startsWith("Bearer ")) {
      try {
        Claims claims=jwtService.parse(header.substring(7));
        String email=claims.getSubject();
        users.findByEmailIgnoreCase(email).ifPresent(user -> {
          if (!"Active".equalsIgnoreCase(user.getAccountStatus())) return;
          var authentication=new UsernamePasswordAuthenticationToken(
            user, null, List.of(new SimpleGrantedAuthority("ROLE_"+user.getRole().name())));
          SecurityContextHolder.getContext().setAuthentication(authentication);
        });
      } catch (Exception ignored) {
        SecurityContextHolder.clearContext();
      }
    }
    filterChain.doFilter(request,response);
  }
}
