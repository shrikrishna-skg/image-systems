package com.imagesystems.persistence;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UsageStatsRepository extends JpaRepository<UsageStatsEntity, String> {

    List<UsageStatsEntity> findByUserIdAndDateGreaterThanEqualOrderByDateDesc(String userId, LocalDate start);
}
