package com.imagesystems.persistence;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JobRepository extends JpaRepository<JobEntity, String>, JobRepositoryCustom {

    Optional<JobEntity> findByIdAndUserId(String id, String userId);

    @Query(
            "SELECT j FROM JobEntity j WHERE j.userId = :uid AND j.resultVersionId IN :vids AND j.status = 'completed'")
    List<JobEntity> findCompletedByUserAndResultVersions(
            @Param("uid") String userId, @Param("vids") Collection<String> resultVersionIds);
}
