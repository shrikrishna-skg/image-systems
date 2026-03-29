package com.imagesystems.persistence;

import java.util.List;

public interface JobRepositoryCustom {

    List<JobEntity> findByUserIdOrderByCreatedAtDesc(String userId, int offset, int limit);
}
