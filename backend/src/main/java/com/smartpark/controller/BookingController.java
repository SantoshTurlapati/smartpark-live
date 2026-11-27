package com.smartpark.controller;

import com.smartpark.dto.BookingDtos.*;
import com.smartpark.model.*;
import com.smartpark.repository.*;
import com.smartpark.service.AvailabilityService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class BookingController {
  private final LocationRepository locations;
  private final SlotRepository slots;
  private final BookingRepository bookings;
  private final PaymentRepository payments;
  private final AvailabilityService availability;

  public BookingController(LocationRepository locations, SlotRepository slots,
                           BookingRepository bookings, PaymentRepository payments,
                           AvailabilityService availability) {
    this.locations=locations;
    this.slots=slots;
    this.bookings=bookings;
    this.payments=payments;
    this.availability=availability;
  }

  @PostMapping("/bookings")
  @PreAuthorize("hasRole('CUSTOMER')")
  @Transactional
  public ResponseEntity<?> create(@AuthenticationPrincipal User customer,
                                  @Valid @RequestBody CreateBookingRequest request) {
    var location=locations.findById(request.locationId()).orElse(null);
    if (location==null || !"Approved".equalsIgnoreCase(location.getStatus())) {
      return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error","Location is unavailable"));
    }
    if (!request.endTime().isAfter(request.startTime())) {
      return ResponseEntity.badRequest().body(Map.of("error","End time must be after start time"));
    }
    var slot=slots.findById(request.slotId()).orElse(null);
    if (slot==null || slot.getLocation()==null || !slot.getLocation().getId().equals(location.getId())
        || !"Available".equalsIgnoreCase(slot.getStatus())) {
      return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error","Slot is no longer available"));
    }
    slot.setStatus("Booked");
    slots.saveAndFlush(slot);

    long hours=Math.max(1,Duration.between(request.startTime(),request.endTime()).toHours());
    Booking booking=new Booking();
    booking.setCustomerId(customer.getId());
    booking.setLocationId(location.getId());
    booking.setSlotId(slot.getId());
    booking.setVehicleNumber(request.vehicleNumber().trim().toUpperCase());
    booking.setStartTime(request.startTime());
    booking.setEndTime(request.endTime());
    booking.setAmount(location.getPricePerHour().multiply(BigDecimal.valueOf(hours)));
    bookings.save(booking);

    Payment payment=new Payment();
    payment.setBookingId(booking.getId());
    payment.setAmount(booking.getAmount());
    payments.save(payment);
    location.setUpdatedAt(java.time.Instant.now());
    locations.save(location);
    availability.publish(location.getId());
    return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("booking",booking,"payment",payment));
  }

  @GetMapping("/bookings")
  @PreAuthorize("isAuthenticated()")
  public List<Booking> list(@AuthenticationPrincipal User user) {
    if (user.getRole()==Role.ADMIN) return bookings.findAllByOrderByCreatedAtDesc();
    if (user.getRole()==Role.CUSTOMER) return bookings.findByCustomerIdOrderByCreatedAtDesc(user.getId());
    var ownedLocationIds=locations.findByOwnerId(user.getId()).stream()
      .map(ParkingLocation::getId).collect(java.util.stream.Collectors.toSet());
    return bookings.findAllByOrderByCreatedAtDesc().stream()
      .filter(booking->ownedLocationIds.contains(booking.getLocationId()))
      .toList();
  }

  @PostMapping("/payments/{bookingId}/complete")
  @PreAuthorize("hasRole('CUSTOMER')")
  @Transactional
  public ResponseEntity<?> completePayment(@AuthenticationPrincipal User customer,
                                           @PathVariable String bookingId,
                                           @RequestBody(required=false) PaymentRequest request) {
    Booking booking=bookings.findById(bookingId).orElse(null);
    if (booking==null || !booking.getCustomerId().equals(customer.getId())) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error","Booking not found"));
    }
    Payment payment=payments.findByBookingId(bookingId).orElse(null);
    if (payment==null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error","Payment not found"));
    payment.setStatus("PAID");
    payments.save(payment);
    booking.setStatus("Confirmed");
    bookings.save(booking);
    return ResponseEntity.ok(Map.of("payment",payment,"booking",booking));
  }
}
