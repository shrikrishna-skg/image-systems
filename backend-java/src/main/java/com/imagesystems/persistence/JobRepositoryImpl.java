package com.imagesystems.persistence;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import org.springframework.stereotype.Repository;

@Repository
public class JobRepositoryImpl implements JobRepositoryCustom {

    @PersistenceContext
    private EntityManager em;

    @Override
    public List<JobEntity> findByUserIdOrderByCreatedAtDesc(String userId, int offset, int limit) {
        return em.createQuery(
                        "SELECT j FROM JobEntity j WHERE j.userId = :uid ORDER BY j.createdAt DESC",
                        JobEntity.class)
                .setParameter("uid", userId)
                .setFirstResult(offset)
                .setMaxResults(limit)
                .getResultList();
    }
}
