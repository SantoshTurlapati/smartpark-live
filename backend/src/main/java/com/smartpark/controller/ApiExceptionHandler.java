package com.smartpark.controller;

import com.smartpark.dto.AuthDtos.ErrorResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<?> validation(MethodArgumentNotValidException ex) {
    String message=ex.getBindingResult().getFieldErrors().stream()
      .findFirst().map(error->error.getDefaultMessage()).orElse("Invalid request");
    return ResponseEntity.badRequest().body(new ErrorResponse(message));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<?> unexpected(Exception ex) {
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
      .body(Map.of("error","An unexpected server error occurred"));
  }
}
