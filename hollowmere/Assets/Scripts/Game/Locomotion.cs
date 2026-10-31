using UnityEngine;

namespace Hollowmere
{
    /// <summary>
    /// Smooth accel, decel, and turn shared by the hero, monsters, and the pet.
    /// Wish velocity comes from the stick, a chase direction, or nav steering.
    /// The speed reported back is the distance actually covered, so a wall does not skate the feet.
    /// </summary>
    public sealed class Locomotion
    {
        public Vector3 velocity;
        public float groundSpeed;

        public void Step(Actor actor, Vector3 wishDir, float wishSpeed, float dt, Vector3 faceDir, bool attacking, bool sweep, bool lockFacing)
        {
            var f = Feel.Active;
            wishDir.y = 0f;
            if (wishDir.sqrMagnitude > 1f) wishDir.Normalize();
            else if (wishDir.sqrMagnitude > 0.0001f) wishDir.Normalize();
            var wish = wishDir * Mathf.Max(0f, wishSpeed);
            float rate = f.accel;
            if (wish.magnitude < velocity.magnitude - 0.01f) rate = f.decel;
            else if (velocity.sqrMagnitude > 0.01f && Vector3.Dot(wish, velocity) < 0f) rate = f.decel;
            velocity = Vector3.MoveTowards(velocity, wish, rate * dt);
            if (wish.sqrMagnitude < 0.000001f && velocity.magnitude < f.idle) velocity = Vector3.zero;

            var delta = velocity * dt;
            if (sweep && delta.sqrMagnitude > 0.000001f)
            {
                var to = World.Sweep(actor.Pos, delta, delta.magnitude);
                delta = to - actor.Pos;
                delta.y = 0f;
            }
            var before = actor.Pos;
            if (delta.sqrMagnitude > 0.0000001f) actor.Move(delta);
            var moved = actor.Pos - before;
            moved.y = 0f;
            groundSpeed = dt > 0.0001f ? moved.magnitude / dt : 0f;
            velocity = groundSpeed < 0.0001f ? Vector3.zero : moved / Mathf.Max(dt, 0.0001f);

            if (lockFacing) return;
            faceDir.y = 0f;
            if (faceDir.sqrMagnitude < 0.0001f) return;
            var target = Quaternion.LookRotation(faceDir.normalized);
            float deg = (attacking ? f.attackTurn : f.turn) * dt;
            actor.transform.rotation = Quaternion.RotateTowards(actor.transform.rotation, target, deg);
        }
    }
}
