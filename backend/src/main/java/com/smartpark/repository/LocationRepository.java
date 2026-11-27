package com.smartpark.repository;
import com.smartpark.model.ParkingLocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
public interface LocationRepository extends JpaRepository<ParkingLocation,String> {
  List<ParkingLocation> findByStatusIgnoreCase(String status);
  List<ParkingLocation> findByOwnerId(String ownerId);
  @Query("select l from ParkingLocation l left join fetch l.slots")
  List<ParkingLocation> findAllWithSlots();
}
