package com.smartpark.repository;
import com.smartpark.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface PaymentRepository extends JpaRepository<Payment,String> {
  Optional<Payment> findByBookingId(String bookingId);
}
